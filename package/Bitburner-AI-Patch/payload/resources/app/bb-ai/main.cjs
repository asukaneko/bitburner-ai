"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const provider = require("./provider.cjs");

function register({ app, ipcMain, net, safeStorage }) {
  const pending = new Map();
  const sessions = require("./sessions.cjs").createSessionStore(() => app.getPath("userData"));
  let sessionKey;
  const settingsPath = () => path.join(app.getPath("userData"), "bitburner-ai.settings.json");
  const encrypted = () => safeStorage?.isEncryptionAvailable() === true;
  function read() {
    let stored = {};
    if (fs.existsSync(settingsPath())) stored = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    let apiKey = sessionKey || "";
    if (sessionKey === undefined && stored.encryptedKey) {
      if (!encrypted()) throw new Error("系统暂时无法解密已保存的密钥，请重新填写。");
      apiKey = safeStorage.decryptString(Buffer.from(stored.encryptedKey, "base64"));
    }
    return { baseUrl: stored.baseUrl || "", model: stored.model || "", apiKey };
  }
  function publicConfig(config) {
    return { baseUrl: config.baseUrl, model: config.model, hasKey: Boolean(config.apiKey), encryptedStorage: encrypted() };
  }
  function save(value) {
    const checked = provider.validateConfig(value);
    const previous = read();
    const apiKey = value.clearKey ? "" : (typeof value.apiKey === "string" && value.apiKey.trim() ? value.apiKey.trim() : previous.apiKey);
    if (apiKey.length > 8192) throw new Error("API Key 长度异常。");
    sessionKey = apiKey;
    const stored = { ...checked };
    if (apiKey && encrypted()) stored.encryptedKey = safeStorage.encryptString(apiKey).toString("base64");
    const temporary = settingsPath() + ".tmp";
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(stored, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, settingsPath());
    return publicConfig({ ...checked, apiKey });
  }
  function trusted(event) {
    try {
      const frame = event.senderFrame;
      if (!frame || frame.parent) return false;
      const url = new URL(frame.url);
      return url.protocol === "file:" && path.resolve(fileURLToPath(url)).toLowerCase() === path.resolve(__dirname, "..", "index.html").toLowerCase();
    } catch { return false; }
  }
  ipcMain.handle("bitburner-ai:request", async (event, method, value = {}) => {
    if (!trusted(event)) return { ok: false, error: "此接口只接受游戏主窗口请求。" };
    let key = "";
    try {
      if (typeof method === "string" && method.startsWith("session:")) return { ok: true, data: sessions.handle(method, value) };
      if (method === "config:get") return { ok: true, data: publicConfig(read()) };
      if (method === "config:save") return { ok: true, data: save(value) };
      const id = event.sender.id;
      if (method === "cancel") { pending.get(id)?.abort(); return { ok: true, data: true }; }
      if (method !== "chat" && method !== "test") throw new Error("未知的助手操作。");
      if (pending.has(id)) throw new Error("上一条请求尚未结束。");
      const config = read(); key = config.apiKey;
      const controller = new AbortController();
      pending.set(id, controller);
      const destroyed = () => controller.abort();
      event.sender.once("destroyed", destroyed);
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        const request = method === "test" ? { messages: [{ role: "user", content: "Reply with OK only." }] } : value;
        const message = await provider.complete(config, request, (...args) => net.fetch(...args), controller.signal);
        return { ok: true, data: message };
      } finally { clearTimeout(timer); pending.delete(id); event.sender.removeListener("destroyed", destroyed); }
    } catch (error) {
      return { ok: false, error: error.name === "AbortError" ? "请求已停止或超时。" : provider.cleanError(error, key) };
    }
  });
  app.on("before-quit", () => { for (const controller of pending.values()) controller.abort(); });
}
module.exports = { register };
