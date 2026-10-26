"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

function createSessionStore(directory) {
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const root = () => path.join(directory(), "bitburner-ai.sessions");
  function file(id) {
    if (typeof id !== "string" || !validId.test(id)) throw new Error("会话编号无效。");
    return path.join(root(), id + ".json");
  }
  function atomic(target, value) {
    const text = JSON.stringify(value);
    if (Buffer.byteLength(text, "utf8") > 32 * 1024 * 1024) throw new Error("这段会话过长，请新建会话继续。");
    fs.mkdirSync(root(), { recursive: true });
    fs.writeFileSync(target + ".tmp", text, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(target + ".tmp", target);
  }
  function active(id) { atomic(path.join(root(), "active.json"), { id }); }
  function read(id, allowDeleted = false) {
    const value = JSON.parse(fs.readFileSync(file(id), "utf8"));
    if (value.id !== id || !Array.isArray(value.events) || !Array.isArray(value.groups)) throw new Error("会话文件格式无效。");
    if (value.deletedAt && !allowDeleted) throw new Error("此会话已删除。");
    return value;
  }
  function summary(value) {
    return { id: value.id, title: value.title, createdAt: value.createdAt, updatedAt: value.updatedAt, count: value.events.filter(event => event.kind === "message").length };
  }
  function list() {
    const sessions = [];
    let activeId = null;
    if (fs.existsSync(root())) {
      for (const name of fs.readdirSync(root())) {
        const id = name.replace(/\.json$/, "");
        if (!name.endsWith(".json") || !validId.test(id)) continue;
        try { const value = read(id); sessions.push(summary(value)); } catch { /* Preserve unreadable files for recovery. */ }
      }
      try { activeId = JSON.parse(fs.readFileSync(path.join(root(), "active.json"), "utf8")).id; } catch { /* No active session yet. */ }
    }
    sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!sessions.some(value => value.id === activeId)) activeId = sessions[0]?.id || null;
    return { sessions, activeId };
  }
  function create() {
    const date = new Date().toISOString();
    const value = { id: randomUUID(), title: "新对话", createdAt: date, updatedAt: date, events: [], groups: [], maxRounds: 200, pending: false, pendingMessage: "", draft: "" };
    atomic(file(value.id), value); active(value.id); return value;
  }
  function save(value) {
    if (!value || !Array.isArray(value.events) || !Array.isArray(value.groups)) throw new Error("会话内容无效。");
    const previous = read(value.id);
    const title = String(value.title || "新对话").replace(/\s+/g, " ").trim().slice(0, 80) || "新对话";
    if (value.events.length > 20000 || value.groups.length > 1000) throw new Error("这段会话过长，请新建会话继续。");
    for (const event of value.events) {
      if (!event || !["message", "tool"].includes(event.kind)) throw new Error("会话记录格式无效。");
      if (event.kind === "message" && (typeof event.text !== "string" || !["你", "AI", "助手"].includes(event.role))) throw new Error("消息格式无效。");
      if (event.kind === "tool" && (typeof event.name !== "string" || typeof event.output !== "string")) throw new Error("执行记录格式无效。");
    }
    for (const group of value.groups) {
      if (!Array.isArray(group) || group.some(message => !message || !["user", "assistant", "tool"].includes(message.role))) throw new Error("会话上下文格式无效。");
    }
    const maxRounds = value.maxRounds === undefined ? (previous.maxRounds || 200) : value.maxRounds;
    if (!Number.isSafeInteger(maxRounds) || maxRounds < 1 || maxRounds > 1000) throw new Error("每轮上限须为 1 到 1,000 之间的整数。");
    const stored = { id: previous.id, title, createdAt: previous.createdAt, updatedAt: new Date().toISOString(), events: value.events, groups: value.groups, maxRounds, pending: value.pending === true, pendingMessage: String(value.pendingMessage || "").slice(0, 12000), draft: String(value.draft || "").slice(0, 12000) };
    atomic(file(stored.id), stored); return summary(stored);
  }
  function handle(method, value = {}) {
    if (method === "session:list") return list();
    if (method === "session:create") return create();
    if (method === "session:get") { const session = read(value.id); active(session.id); return session; }
    if (method === "session:save") return save(value);
    if (method === "session:delete") {
      const session = read(value.id); session.deletedAt = new Date().toISOString();
      atomic(file(session.id), session); return { id: session.id };
    }
    if (method === "session:restore") {
      const session = read(value.id, true); delete session.deletedAt; session.updatedAt = new Date().toISOString();
      atomic(file(session.id), session); return summary(session);
    }
    throw new Error("未知的会话操作。");
  }
  return { handle };
}
module.exports = { createSessionStore };
