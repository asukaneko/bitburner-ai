const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { pathToFileURL } = require("node:url");
const { JSDOM } = require("jsdom");
const src = name => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
const provider = require("../src/provider.cjs");
const agent = require("../src/agent.js");
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const { createSessionStore } = require("../src/sessions.cjs");

function withSessions(t, request, store) {
  if (!store) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bb-ai-sessions-test-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    store = createSessionStore(() => directory);
  }
  return async (method, value) => method.startsWith("session:") ? { ok: true, data: store.handle(method, value) } : request(method, value);
}

async function settle(predicate, description = "UI update") {
  for (let i = 0; i < 40; i++) { await tick(); if (predicate()) return; }
  assert.fail(description + " did not complete");
}

function loadMarkdown(w) {
  w.eval(fs.readFileSync(path.join(__dirname, "..", "node_modules", "marked", "lib", "marked.umd.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(__dirname, "..", "node_modules", "dompurify", "dist", "purify.min.js"), "utf8"));
}

function installTerminalKeyHandler(w) {
  const handler = fs.readFileSync(path.join(__dirname, "fixtures", "terminal-keydown-3.0.1.js"), "utf8");
  const terminal = w.document.createElement("input");
  terminal.id = "test-terminal"; w.document.body.append(terminal);
  const callback = new w.Function("Terminal", "terminalInput", "KEY", handler + "; return keyDown;")({ action: null, contractOpen: false, nsPromptApiOpen: false }, { current: terminal }, { C: "c" });
  w.document.addEventListener("keydown", callback);
  return terminal;
}

test("assistant input retains focus with the real terminal keyboard handler active", async t => {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  const terminal = installTerminalKeyHandler(w);
  w.BitburnerAI = { ready: () => true, tools: () => [], execute: async () => ({}) };
  w.BitburnerAIBridge = { request: withSessions(t, async () => ({ ok: true, data: { baseUrl: "", model: "", hasKey: false } })) };
  w.eval(src("agent.js")); w.eval(src("assistant.js")); await tick();
  const root = w.document.getElementById("bitburner-ai-assistant").shadowRoot;
  root.getElementById("launcher").click();
  for (const id of ["prompt", "base-url", "model", "api-key"]) {
    const input = root.getElementById(id); input.focus();
    for (const key of ["h", "Enter", "Backspace", "ArrowLeft", "ArrowUp", " "]) {
      const event = new w.KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true });
      input.dispatchEvent(event);
      assert.equal(root.activeElement, input, `${id}: ${key} must not redirect focus to the terminal`);
      assert.equal(event.defaultPrevented, false, "native input behavior must remain available");
    }
    const composing = new w.KeyboardEvent("keydown", { key: "Process", isComposing: true, keyCode: 229, bubbles: true, composed: true });
    input.dispatchEvent(composing);
    assert.equal(root.activeElement, input);
  }
  terminal.focus();
  terminal.dispatchEvent(new w.KeyboardEvent("keydown", { key: "h", bubbles: true, composed: true }));
  assert.equal(w.document.activeElement, terminal, "terminal typing outside the panel still works");
  const prompt = root.getElementById("prompt"); prompt.focus();
  prompt.dispatchEvent(new w.KeyboardEvent("keydown", { key: "A", code: "KeyA", ctrlKey: true, shiftKey: true, bubbles: true, composed: true }));
  assert.equal(root.getElementById("panel").hidden, true, "panel shortcut still works inside shadow DOM");
  terminal.dispatchEvent(new w.KeyboardEvent("keydown", { key: "A", code: "KeyA", ctrlKey: true, shiftKey: true, bubbles: true, composed: true }));
  assert.equal(root.getElementById("panel").hidden, false, "global panel shortcut still works outside the panel");
});

test("all plugin and patched entry scripts parse", () => {
  for (const name of ["provider.cjs", "main.cjs", "sessions.cjs", "agent.js", "integration.js", "assistant.js"]) new vm.Script(src(name));
  const base = path.join(__dirname, "..", "package", "Bitburner-AI-Patch", "payload", "resources", "app");
  for (const name of ["main.js", "preload.js"]) new vm.Script(fs.readFileSync(path.join(base, name), "utf8"));
});

test("provider validates compatible URLs and redacts secret errors", () => {
  assert.equal(provider.endpoint("https://example.com/v1/"), "https://example.com/v1/chat/completions");
  assert.equal(provider.endpoint("http://127.0.0.1:11434/v1/chat/completions"), "http://127.0.0.1:11434/v1/chat/completions");
  assert.throws(() => provider.endpoint("http://example.com/v1"));
  assert.throws(() => provider.endpoint("https://key@example.com/v1"));
  assert.throws(() => provider.endpoint("https://example.com/v1?api_key=test"));
  assert.equal(provider.cleanError(new Error("bad unit-secret"), "unit-secret"), "bad [已隐藏密钥]");
});

test("real HTTP request preserves tool protocol and supports local endpoints", async t => {
  let received;
  const server = http.createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    received = { url: req.url, authorization: req.headers.authorization, body: JSON.parse(body) };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: null, reasoning_content: "reasoning", tool_calls: [{ id: "c1", type: "function", function: { name: "get_state", arguments: "{}" } }] } }] }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const result = await provider.complete({ baseUrl: `http://127.0.0.1:${server.address().port}/v1`, model: "custom-model", apiKey: "test-secret" }, { messages: [{ role: "user", content: "test" }], tools: [{ type: "function", function: { name: "get_state" } }] }, fetch);
  assert.equal(received.url, "/v1/chat/completions");
  assert.equal(received.authorization, "Bearer test-secret");
  assert.equal(received.body.model, "custom-model");
  assert.equal(received.body.stream, false);
  assert.equal(received.body.tool_choice, "auto");
  assert.equal(result.tool_calls[0].id, "c1");
  assert.equal(result.reasoning_content, "reasoning");
});

test("provider reports API and malformed response errors", async () => {
  const config = { baseUrl: "https://example.com/v1", model: "custom" };
  const request = { messages: [] };
  await assert.rejects(provider.complete(config, request, async () => new Response("oops", { status: 502 })), /非 JSON/);
  await assert.rejects(provider.complete(config, request, async () => Response.json({ error: { message: "denied" } }, { status: 401 })), /401.*denied/);
  await assert.rejects(provider.complete(config, request, async () => Response.json({ choices: [] })), /可用/);
});

test("IPC settings encrypt keys and only accept the game main frame", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bb-ai-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let handler;
  let requests = 0;
  const app = new EventEmitter(); app.getPath = () => directory;
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from("encrypted:" + value), decryptString: value => value.toString().slice(10) };
  require("../src/main.cjs").register({ app, safeStorage, ipcMain: { handle: (channel, fn) => { assert.equal(channel, "bitburner-ai:request"); handler = fn; } }, net: { fetch: async () => { requests++; return Response.json({ choices: [{ message: { content: "OK" } }] }); } } });
  const sender = new EventEmitter(); sender.id = 1;
  const event = { sender, senderFrame: { parent: null, url: pathToFileURL(path.resolve(__dirname, "..", "index.html")).href } };
  assert.equal((await handler({ ...event, senderFrame: { url: "https://example.com" } }, "config:get")).ok, false);
  const saved = await handler(event, "config:save", { baseUrl: "https://example.com/v1", model: "custom", apiKey: "private-test-secret" });
  assert.equal(saved.ok, true);
  assert.equal(saved.data.hasKey, true);
  assert.equal(saved.data.apiKey, undefined);
  assert.ok(!fs.readFileSync(path.join(directory, "bitburner-ai.settings.json"), "utf8").includes("private-test-secret"));
  assert.equal((await handler(event, "test")).data.content, "OK");
  assert.equal(requests, 1);
  assert.equal((await handler(event, "config:save", { baseUrl: "https://example.com/v1", model: "custom", clearKey: true })).data.hasKey, false);
});

function integration() {
  const home = { hostname: "home", hasAdminRights: true, maxRam: 8, ramUsed: 0, serversOnNetwork: ["n00dles"], scripts: new Map(), textFiles: new Map(), runningScriptMap: new Map() };
  const target = { hostname: "n00dles", hasAdminRights: false, maxRam: 4, ramUsed: 0, serversOnNetwork: ["home"], scripts: new Map(), runningScriptMap: new Map() };
  const servers = new Map([["home", home], ["n00dles", target]]);
  const tutorial = { isRunning: false };
  let nextPid = 10;
  const exported = {};
  // Exercise the actual game's compiled RAM/permission validator, without starting its engine.
  const compiled = fs.readFileSync(path.join(__dirname, "fixtures", "netscript-worker-3.0.1.js"), "utf8").replace(/^,/m, "");
  const factory = vm.runInNewContext("({" + compiled + "})[64882]");
  const dependency = id => id === 167478 ? { F: class { constructor(script, ram, args) { this.filename = script.filename; this.ramUsage = ram; this.args = args; this.server = "home"; this.logs = ["started"]; } } } : id === 105425 ? { ko: ram => ram + "GB" } : {};
  dependency.d = (object, descriptors) => { for (const [key, get] of Object.entries(descriptors)) Object.defineProperty(object, key, { get }); };
  factory({}, exported, dependency);
  const workers = { Oc: exported.Oc, CV: script => { script.pid = nextPid++; const group = new Map([[script.pid, script]]); home.runningScriptMap.set(script.pid, group); home.ramUsed += script.ramUsage * script.threads; return script.pid; } };
  const rfa = {
    pushFile: msg => {
      const { filename, content } = msg.params;
      if (filename.endsWith(".txt")) home.textFiles.set(filename, { content });
      else home.scripts.set(filename, { filename, content, getRamUsage: () => 2, ramCalculationError: null });
      return { result: "OK" };
    },
    getFile: msg => ({ result: home.scripts.get(msg.params.filename)?.content || home.textFiles.get(msg.params.filename)?.content || "" }),
    getFileNames: () => ({ result: [...home.scripts.keys(), ...home.textFiles.keys()] }),
    getDefinitionFile: () => ({ result: "hack(host: string): Promise<number>;" }),
  };
  const modules = { 576191: { ai: { money: 1000, skills: { hacking: 1 }, getHomeComputer: () => home } }, 47657: { mC: host => servers.get(host) }, 970557: { D: rfa }, 64882: workers, 919946: { OZ: tutorial }, 251130: { MM: pid => { const group = home.runningScriptMap.get(pid); const script = group?.get(pid); if (!script) return false; home.ramUsed -= script.ramUsage * script.threads; return home.runningScriptMap.delete(pid); } } };
  const window = { webpackChunkbitburner: { push: chunk => chunk[2](id => modules[id]) } };
  vm.runInNewContext(src("integration.js"), { window, Date });
  return { api: window.BitburnerAI, home, tutorial };
}

test("game tools preserve mode, filename, RAM and tutorial constraints", async () => {
  const { api, home, tutorial } = integration();
  assert.equal(api.ready(), true);
  assert.equal((await api.execute("scan_network")).length, 2);
  await assert.rejects(api.execute("write_script", { filename: "ai/test.js", content: "x" }), /模式/);
  await assert.rejects(api.execute("write_script", { filename: "existing.js", content: "x" }, true), /ai\//);
  await assert.rejects(api.execute("write_script", { filename: "ai/../test.js", content: "x" }, true), /文件名/);
  assert.ok(!api.tools(false).some(tool => tool.function.name === "run_script"));
  await api.execute("write_script", { filename: "ai/test.js", content: "first version" }, true);
  const overwritten = await api.execute("write_script", { filename: "ai/test.js", content: "second version" }, true);
  assert.equal(home.textFiles.get(overwritten.backup).content, "first version");
  await assert.rejects(api.execute("run_script", { filename: "ai/test.js", threads: 10 }, true), /requires/);
  tutorial.isRunning = true;
  await assert.rejects(api.execute("run_script", { filename: "ai/test.js" }, true), /教程/);
  tutorial.isRunning = false;
  const run = await api.execute("run_script", { filename: "ai/test.js", threads: 2, args: ["n00dles"] }, true);
  assert.equal(home.ramUsed, 4);
  assert.equal((await api.execute("run_script", { filename: "ai/test.js", args: ["n00dles"] }, true)).alreadyRunning, true);
  assert.equal((await api.execute("get_script_logs", { pid: run.pid })).logs[0], "started");
  await assert.rejects(api.execute("stop_script", { pid: 999 }, true), /只能停止/);
  assert.equal((await api.execute("stop_script", { pid: run.pid }, true)).stopped, true);
  assert.equal(home.ramUsed, 0);
});

test("agent completes sequential deployment and returns tool outputs with matching IDs", async () => {
  const { api } = integration();
  let round = 0;
  const bridge = async (method, body) => {
    round++;
    if (round === 2) assert.equal(body.messages.at(-1).tool_call_id, "write");
    if (round <= 2) return { role: "assistant", content: null, tool_calls: [{ id: round === 1 ? "write" : "run", type: "function", function: { name: round === 1 ? "write_script" : "run_script", arguments: JSON.stringify(round === 1 ? { filename: "ai/test.js", content: "export async function main(ns) {}" } : { filename: "ai/test.js" }) } }] };
    return { role: "assistant", content: "已完成" };
  };
  const turn = await agent.run({ message: "运行测试", auto: true, bridge, game: api });
  assert.equal(turn.at(-1).content, "已完成");
  assert.equal(turn.filter(item => item.role === "tool").length, 2);
});

test("cancellation prevents queued model tool calls from executing", async () => {
  const controller = new AbortController();
  let mutations = 0;
  const game = { tools: () => [{ function: { name: "write_script" } }], execute: async name => { if (name !== "get_state") mutations++; return {}; } };
  const bridge = async () => { controller.abort(); return { role: "assistant", tool_calls: [{ id: "1", function: { name: "write_script", arguments: "{}" } }] }; };
  await assert.rejects(agent.run({ message: "test", auto: true, bridge, game, signal: controller.signal }), /停止/);
  assert.equal(mutations, 0);
});

test("agent permits 200 rounds while preserving complete tool exchanges in bounded requests", async () => {
  let requests = 0;
  let actions = 0;
  let progress = 0;
  const tools = [{ type: "function", function: { name: "get_state" } }];
  const game = { tools: () => tools, execute: async name => name === "get_state" ? { step: ++actions, details: "state ".repeat(100) } : {} };
  const bridge = async (method, body) => {
    requests++;
    assert.ok(body.messages.length <= 88);
    assert.ok(JSON.stringify(body).length < 300000);
    let expected = [];
    for (const message of body.messages) {
      if (message.role === "tool") { assert.ok(expected.includes(message.tool_call_id)); expected = expected.filter(id => id !== message.tool_call_id); }
      else { assert.equal(expected.length, 0, "all tool calls must have outputs before the next message"); expected = message.tool_calls?.map(call => call.id) || []; }
    }
    assert.equal(expected.length, 0);
    return { role: "assistant", content: null, tool_calls: [{ id: "step-" + requests, type: "function", function: { name: "get_state", arguments: "{}" } }] };
  };
  const turn = await agent.run({ message: "持续分析", auto: true, bridge, game, onEvent: event => { if (event.type === "round") progress = event.round; } });
  assert.equal(requests, 200); assert.equal(progress, 200);
  assert.equal(turn.filter(message => message.role === "tool").length, 200);
  assert.match(turn.at(-1).content, /200/);
});

test("large parallel tool outputs fit the compatible API request budget", async () => {
  let requests = 0;
  const game = { tools: () => [{ function: { name: "read_file" } }], execute: async name => name === "get_state" ? {} : "x".repeat(25000) };
  const bridge = async (method, body) => {
    assert.ok(JSON.stringify(body).length < 300000);
    if (++requests === 1) return { role: "assistant", content: null, tool_calls: Array.from({ length: 12 }, (_, index) => ({ id: "call-" + index, type: "function", function: { name: "read_file", arguments: "{}" } })) };
    assert.equal(body.messages.filter(message => message.role === "tool").length, 12);
    return { role: "assistant", content: "完成" };
  };
  await agent.run({ message: "读取文件", bridge, game }); assert.equal(requests, 2);
});

test("assistant UI loads, preserves secret input, renders model text safely and restores focus", async t => {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.BitburnerAI = { ready: () => true, tools: () => [], execute: async () => ({ money: 100 }) };
  w.BitburnerAIBridge = { request: withSessions(t, async method => ({ ok: true, data: method === "chat" ? { role: "assistant", content: '<img src=x onerror="alert(1)">\n\n```js\nns.hack("n00dles");\n```' } : { baseUrl: "https://example.com/v1", model: "custom", hasKey: true, encryptedStorage: true } })) };
  loadMarkdown(w); w.eval(src("agent.js")); w.eval(src("assistant.js")); await tick();
  const root = w.document.getElementById("bitburner-ai-assistant").shadowRoot;
  root.getElementById("launcher").click();
  assert.equal(root.getElementById("panel").hidden, false);
  assert.equal(root.activeElement.id, "prompt");
  assert.equal(root.getElementById("api-key").value, "");
  await settle(() => !root.getElementById("send").disabled, "session initialization");
  root.getElementById("prompt").value = "test"; root.getElementById("send").click();
  await settle(() => !root.getElementById("send").disabled, "model response");
  assert.equal(root.querySelectorAll("img").length, 0);
  assert.equal(root.querySelectorAll("[onerror]").length, 0);
  assert.equal(root.querySelector("code").textContent, 'ns.hack("n00dles");\n');
  root.getElementById("close").click(); assert.equal(root.activeElement.id, "launcher");
});

test("Markdown renders headings, lists, tables and code while stripping executable HTML", async t => {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" }); t.after(() => dom.window.close());
  const w = dom.window;
  const markdown = '# 标题\n\n**粗体**与`行内代码`\n\n- 第一项\n- 第二项\n\n> 引用\n\n| 字段 | 值 |\n| --- | --- |\n| RAM | 8GB |\n\n```js\nconst x = "<script>";\n```\n\n[文档](https://example.com/docs) [危险](javascript:alert(1))\n\n<script>alert(1)</script><img src=x onerror=alert(1)><iframe src="file:///C:/test"></iframe>';
  w.BitburnerAI = { ready: () => true, tools: () => [], execute: async () => ({}) };
  w.BitburnerAIBridge = { request: withSessions(t, async method => ({ ok: true, data: method === "chat" ? { role: "assistant", content: markdown } : { baseUrl: "", model: "", hasKey: false } })) };
  loadMarkdown(w); w.eval(src("agent.js")); w.eval(src("assistant.js"));
  const root = w.document.getElementById("bitburner-ai-assistant").shadowRoot;
  await settle(() => !root.getElementById("send").disabled);
  root.getElementById("prompt").value = "展示 Markdown"; root.getElementById("send").click();
  await settle(() => !root.getElementById("send").disabled);
  const rendered = root.querySelector(".markdown");
  assert.equal(rendered.querySelector("h1").textContent, "标题");
  assert.equal(rendered.querySelector("strong").textContent, "粗体");
  assert.equal(rendered.querySelectorAll("li").length, 2);
  assert.equal(rendered.querySelectorAll("td").length, 2);
  assert.equal(rendered.querySelector("blockquote").textContent.trim(), "引用");
  assert.equal(rendered.querySelector("pre code").textContent, 'const x = "<script>";\n');
  assert.equal(rendered.querySelectorAll("script,img,iframe,[onerror]").length, 0);
  assert.equal(rendered.querySelector('a[href="https://example.com/docs"]').target, "_blank");
  assert.equal([...rendered.querySelectorAll("a")].find(a => a.textContent === "危险").hasAttribute("href"), false);
  assert.equal(rendered.querySelector(".copy").textContent, "复制代码");
});

test("fullscreen supports native entry, restoration and window-sized fallback", async t => {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" }); t.after(() => dom.window.close());
  const w = dom.window;
  w.BitburnerAI = { ready: () => true, tools: () => [], execute: async () => ({}) };
  w.BitburnerAIBridge = { request: withSessions(t, async () => ({ ok: true, data: { baseUrl: "", model: "", hasKey: false } })) };
  w.eval(src("agent.js")); w.eval(src("assistant.js")); await tick();
  const host = w.document.getElementById("bitburner-ai-assistant"); const root = host.shadowRoot;
  host.requestFullscreen = async () => { Object.defineProperty(w.document, "fullscreenElement", { configurable: true, value: host }); w.document.dispatchEvent(new w.Event("fullscreenchange")); };
  w.document.exitFullscreen = async () => { Object.defineProperty(w.document, "fullscreenElement", { configurable: true, value: null }); w.document.dispatchEvent(new w.Event("fullscreenchange")); };
  root.getElementById("launcher").click(); root.getElementById("fullscreen").click(); await tick();
  assert.equal(w.document.fullscreenElement, host);
  assert.equal(root.getElementById("panel").classList.contains("fullscreen"), true);
  root.getElementById("prompt").dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true, cancelable: true })); await tick();
  assert.equal(root.getElementById("panel").classList.contains("fullscreen"), false);
  assert.equal(root.getElementById("panel").hidden, false, "first Escape restores the panel without closing it");
  host.requestFullscreen = async () => { throw new Error("unavailable"); };
  root.getElementById("fullscreen").click(); await tick();
  assert.equal(root.getElementById("panel").classList.contains("fullscreen"), true);
  root.getElementById("close").click(); assert.equal(root.getElementById("panel").classList.contains("fullscreen"), false);
});

test("session store persists across restarts, manages titles and safely restores deletions", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bb-ai-store-test-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const first = createSessionStore(() => directory);
  const session = first.handle("session:create");
  session.title = "赚钱脚本"; session.events.push({ kind: "message", role: "你", text: "保留这段对话" });
  session.groups.push([{ role: "user", content: "保留这段对话" }, { role: "assistant", content: "好的" }]);
  session.draft = "未发送的草稿";
  first.handle("session:save", session);
  const restarted = createSessionStore(() => directory);
  assert.equal(restarted.handle("session:list").activeId, session.id);
  assert.equal(restarted.handle("session:get", { id: session.id }).events[0].text, "保留这段对话");
  assert.equal(restarted.handle("session:get", { id: session.id }).draft, "未发送的草稿");
  restarted.handle("session:delete", { id: session.id }); assert.equal(restarted.handle("session:list").sessions.length, 0);
  restarted.handle("session:restore", { id: session.id }); assert.equal(restarted.handle("session:list").sessions[0].title, "赚钱脚本");
  assert.throws(() => restarted.handle("session:get", { id: "../../outside" }), /编号/);
});

test("UI session switching, renaming, deletion and restored chat context survive a new window", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bb-ai-ui-store-test-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createSessionStore(() => directory);
  let lastMessages;
  async function openWindow() {
    const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" }); t.after(() => dom.window.close());
    const w = dom.window;
    w.BitburnerAI = { ready: () => true, tools: () => [], execute: async () => ({}) };
    w.BitburnerAIBridge = { request: withSessions(t, async (method, value) => {
      if (method === "chat") { lastMessages = value.messages; return { ok: true, data: { role: "assistant", content: "**已记住**" } }; }
      return { ok: true, data: { baseUrl: "", model: "", hasKey: false } };
    }, store) };
    loadMarkdown(w); w.eval(src("agent.js")); w.eval(src("assistant.js"));
    const root = w.document.getElementById("bitburner-ai-assistant").shadowRoot;
    await settle(() => !root.getElementById("send").disabled);
    return { dom, w, root };
  }
  const first = await openWindow(); const root = first.root;
  const initialId = root.getElementById("session-list").value;
  root.getElementById("prompt").value = "请记住我的目标"; root.getElementById("send").click(); await settle(() => !root.getElementById("send").disabled);
  root.getElementById("rename-session").click(); root.getElementById("session-title").value = "我的进度"; root.getElementById("save-title").click(); await settle(() => !root.getElementById("send").disabled);
  root.getElementById("new-session").click(); await settle(() => !root.getElementById("send").disabled);
  assert.notEqual(root.getElementById("session-list").value, initialId);
  root.getElementById("session-list").value = initialId; root.getElementById("session-list").dispatchEvent(new first.w.Event("change")); await settle(() => !root.getElementById("send").disabled);
  assert.match(root.getElementById("messages").textContent, /请记住我的目标/);
  root.getElementById("prompt").value = "草稿内容"; root.getElementById("prompt").dispatchEvent(new first.w.Event("input", { bubbles: true, composed: true }));
  await new Promise(resolve => setTimeout(resolve, 150));
  const second = await openWindow();
  assert.equal(second.root.getElementById("session-list").value, initialId);
  assert.equal(second.root.getElementById("prompt").value, "草稿内容");
  assert.match(second.root.getElementById("messages").textContent, /请记住我的目标/);
  assert.equal(second.root.querySelector(".markdown strong").textContent, "已记住");
  second.root.getElementById("prompt").value = "继续"; second.root.getElementById("send").click(); await settle(() => !second.root.getElementById("send").disabled);
  assert.ok(lastMessages.some(message => message.content === "请记住我的目标"), "restored messages remain in model context");
  second.root.getElementById("delete-session").click(); await settle(() => !second.root.getElementById("send").disabled);
  assert.notEqual(second.root.getElementById("session-list").value, initialId);
  second.root.getElementById("undo-delete").click(); await settle(() => !second.root.getElementById("send").disabled);
  assert.equal(second.root.getElementById("session-list").value, initialId);
});
