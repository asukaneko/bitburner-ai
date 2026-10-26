(function () {
  "use strict";
  if (document.getElementById("bitburner-ai-assistant")) return;
  const host = document.createElement("div");
  host.id = "bitburner-ai-assistant";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host{all:initial;color-scheme:dark;font:14px/1.55 Consolas,"Microsoft YaHei",monospace;color:#e3e9e5}:host(:fullscreen){display:block;width:100vw;height:100vh;background:#101713}
      *{box-sizing:border-box} [hidden]{display:none!important}
      button,input,textarea,select{font:inherit} button{cursor:pointer;color:inherit;background:#19251e;border:1px solid #42614d;border-radius:4px;padding:7px 12px;min-height:36px}
      button:hover{background:#24392c} button:disabled{opacity:.5;cursor:default}
      :is(button,input,textarea,select):focus-visible{outline:2px solid #9ceeab;outline-offset:2px}
      input,textarea,select{background:#101613;color:#e3e9e5;border:1px solid #45564a;border-radius:3px;padding:8px;width:100%;min-width:0}
      #launcher{position:fixed;right:20px;bottom:20px;z-index:10000;border-color:#77c58a;color:#a5f3b5;background:#0d1811;padding:9px 17px}
      #panel{position:fixed;z-index:10001;right:16px;bottom:16px;width:min(540px,calc(100vw - 32px));height:min(800px,calc(100vh - 44px));background:#101713;border:1px solid #507059;border-radius:6px;box-shadow:0 8px 30px #0008;display:flex;flex-direction:column;overflow:hidden}
      #panel.fullscreen{inset:0;width:100vw;height:100vh;border-radius:0}#panel.fullscreen #messages,#panel.fullscreen footer{padding-left:clamp(16px,4vw,64px);padding-right:clamp(16px,4vw,64px)}#panel.fullscreen #settings{max-height:35%}
      header{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #324337} h2{font-size:17px;margin:0;white-space:nowrap} #game-status{color:#b1bcb4;font-size:12px;flex:1} header button{padding:4px 10px}
      .toolbar{display:flex;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid #2a3a2f}.toolbar select{flex:1;min-width:100px}.toolbar button{white-space:nowrap}.round-control{display:flex;align-items:center;gap:5px;white-space:nowrap}.round-control input{width:68px;padding:5px}
      .context-row{display:flex;align-items:center;gap:9px;padding:8px 14px;border-bottom:1px solid #2a3a2f}.context-track{height:8px;flex:1;min-width:36px;border-radius:5px;background:#27342c;overflow:hidden}.context-track span{display:block;height:100%;width:0;background:#79cf8e;transition:width .2s}.context-track.over span{background:#e9a45d}.context-label{white-space:nowrap;font-size:11px;color:#b4c4b8}.context-row button{white-space:nowrap;padding:5px 9px;font-size:12px}
      .sessions{display:flex;gap:6px;align-items:center;padding:9px 14px;border-bottom:1px solid #2a3a2f}.sessions select{flex:1}.sessions button{white-space:nowrap;padding:6px 9px;font-size:12px}#session-edit{padding:8px 14px;display:flex;gap:6px}#session-edit input{flex:1}#session-edit button{white-space:nowrap}#undo-delete{font-size:12px}
      #settings{border-bottom:1px solid #324337;max-height:48%;overflow:auto} summary{cursor:pointer;padding:9px 14px;color:#bdd2c3} summary:hover{color:#a5f3b5} .settings-body{padding:0 14px 12px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
      label{display:block;color:#c2d0c6;font-size:12px} label input{display:block;margin-top:4px}.full{grid-column:1/-1}.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.muted{font-size:12px;color:#a9b6ad;margin:0}.primary{background:#79cf8e;color:#08150d;border-color:#79cf8e;font-weight:bold}.primary:hover{background:#9fe6af}
      #config-status{font-size:12px;overflow-wrap:anywhere} #messages{flex:1;min-height:80px;overflow:auto;padding:14px;overscroll-behavior:contain}.message{margin:0 0 18px;overflow-wrap:anywhere}.role{display:block;font-size:12px;color:#a2b1a6;margin-bottom:5px}.content{white-space:pre-wrap}.user{border-bottom:1px solid #283b2e;padding-bottom:12px}.error{color:#ffb8a7}
      .markdown{white-space:normal}.markdown p{margin:0 0 .8em}.markdown :is(h1,h2,h3,h4,h5,h6){line-height:1.35;margin:1em 0 .5em;font-weight:600}.markdown h1{font-size:24px}.markdown h2{font-size:21px}.markdown h3{font-size:18px}.markdown :is(h4,h5,h6){font-size:15px}.markdown :first-child{margin-top:0}.markdown :is(ul,ol){padding-left:1.7em;margin:.5em 0 1em}.markdown li{margin:.25em 0}.markdown li>p{margin:.3em 0}.markdown blockquote{margin:.8em 0;padding:6px 14px;border-left:3px solid #62836c;color:#b7c8bd}.markdown blockquote p:last-child{margin-bottom:0}.markdown :not(pre)>code{background:#26352b;color:#c7f2d1;padding:2px 5px;border-radius:3px;font-size:.93em}.markdown a{color:#a5edb6;text-decoration:underline;text-underline-offset:3px}.markdown hr{border:0;border-top:1px solid #405448;margin:1em 0}.markdown table{border-collapse:collapse;min-width:240px;margin:.5em 0;font-size:13px}.markdown :is(th,td){border:1px solid #405448;padding:7px 10px;text-align:left}.markdown th{background:#23342a}.table-scroll{overflow:auto;max-width:100%}.markdown input[type=checkbox]{width:auto;margin-right:6px}.code-block{margin:10px 0}.code-heading{display:flex;justify-content:space-between;align-items:center;color:#b3c8b9;font-size:12px}.code-block pre{margin-top:5px}
      pre{background:#080e0a;border:1px solid #324337;padding:10px;white-space:pre;overflow:auto;max-height:330px;font-size:12px;line-height:1.5;margin:8px 0} code{font:inherit}.copy{padding:2px 9px;min-height:30px;font-size:12px}.tool{margin:7px 0;color:#aebdb3}.tool summary{padding:4px 0;font-size:12px}.tool pre{white-space:pre-wrap}
      #activity{min-height:28px;padding:3px 14px;color:#a5dcb2;font-size:12px;border-top:1px solid #2a3a2f} footer{padding:8px 14px 12px;display:grid;gap:8px} textarea{resize:vertical;min-height:76px;max-height:200px;line-height:1.5}.footer-actions{display:flex;justify-content:space-between;gap:8px;align-items:center}.footer-buttons{display:flex;gap:8px}.hint{font-size:11px;color:#a5b2a9}
      @media(max-width:650px){#panel{right:6px;bottom:6px;width:calc(100vw - 12px);height:calc(100vh - 12px)}.settings-body{grid-template-columns:1fr}.full{grid-column:auto}.toolbar{flex-wrap:wrap}.toolbar select{flex:1 1 140px}.round-control{font-size:11px}.round-control input{width:58px}#context-label{font-size:10px}.context-row{gap:6px}#compress-context{font-size:11px;padding:5px 6px}#game-status{font-size:11px}#kill{font-size:12px;padding:6px}.hint{display:none}}
    </style>
    <button id="launcher" aria-expanded="false" aria-controls="panel">AI 助手</button>
    <section id="panel" aria-label="Bitburner AI 助手" hidden>
      <header><h2>AI 助手</h2><span id="game-status" role="status">等待游戏加载</span><button id="fullscreen" aria-label="全屏显示 AI 助手" aria-pressed="false">全屏</button><button id="close" aria-label="收起 AI 助手">收起</button></header>
      <div class="sessions"><select id="session-list" aria-label="选择会话"></select><button id="new-session">新建</button><button id="rename-session">重命名</button><button id="delete-session">删除</button><button id="undo-delete" hidden>撤销删除</button></div>
      <div id="session-edit" hidden><input id="session-title" aria-label="会话名称" maxlength="80"><button id="save-title">保存名称</button><button id="cancel-title">取消</button></div>
      <div class="toolbar"><label for="mode">模式</label><select id="mode"><option value="explain">讲解与写脚本</option><option value="auto">自动部署与运行</option></select><label class="round-control" for="round-limit">轮数<input id="round-limit" type="number" min="1" max="1000" step="1" value="200" aria-label="每轮循环上限" title="本轮模型调用上限，1–1000 次">次</label><button id="kill" title="停止本次会话中由助手启动的脚本">停止 AI 脚本</button></div>
      <div class="context-row"><div id="context-track" class="context-track" role="meter" aria-label="当前上下文占用比例" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="context-fill"></span></div><span id="context-label" class="context-label">上下文占用估算中</span><button id="compress-context" type="button" title="用本地摘要压缩较早的对话，保留近期内容">压缩上下文</button></div>
      <details id="settings"><summary>模型设置</summary><form class="settings-body" id="config-form">
        <label class="full">接口地址<input id="base-url" type="url" placeholder="https://你的服务地址/v1" autocomplete="off" required></label>
        <label>模型名称<input id="model" placeholder="填写服务商提供的模型名" autocomplete="off" required></label>
        <label>API Key<input id="api-key" type="password" placeholder="留空沿用已保存密钥" autocomplete="off"></label>
        <label class="full">模型上下文窗口（Token）<input id="context-window" type="number" min="4096" max="2000000" step="1024" value="128000" required></label>
        <p class="muted full">占比按文字长度估算；接口提供 Token 用量时显示实际值。自动模式需要模型支持工具调用。</p>
        <div class="actions full"><button class="primary" type="submit" id="save">保存配置</button><button type="button" id="test">测试连接</button><button type="button" id="clear-key">清除密钥</button><span id="config-status" role="status"></span></div>
      </form></details>
      <div id="messages" role="log" aria-live="polite" aria-label="对话与执行记录"></div>
      <div id="activity" role="status">填写模型设置后即可开始。</div>
      <footer><textarea id="prompt" aria-label="向 AI 助手发送消息" placeholder="例如：看看我的进度，教我怎么写第一个赚钱脚本。"></textarea><div class="footer-actions"><button id="clear">清空对话</button><span class="hint">Ctrl+Enter 发送 · Ctrl+Shift+A 收起/展开</span><div class="footer-buttons"><button id="stop" hidden>停止本轮</button><button id="send" class="primary">发送</button></div></div></footer>
    </section>`;
  document.body.append(host);
  const $ = id => shadow.getElementById(id);
  const game = window.BitburnerAI;
  const groups = [];
  let busy = false;
  let controller;
  let expanded = false;
  let nativeFullscreen = false;
  let currentSession;
  let switching = true;
  let saveTimer;
  let storageQueue = Promise.resolve();
  let deletedSession;
  let contextWindow = 128000;
  let contextRefreshTimer;
  async function bridge(method, value) {
    if (!window.BitburnerAIBridge) throw new Error("请完全退出并重启游戏，以加载 AI 助手。");
    let result;
    try { result = await window.BitburnerAIBridge.request(method, value); }
    catch (error) { throw new Error(String(error.message).includes("No handler") ? "请完全退出并重启游戏，以加载 AI 助手。" : error.message); }
    if (!result?.ok) throw new Error(result?.error || "助手请求失败。");
    return result.data;
  }
  function toggle(open) {
    if (!open && expanded) leaveFullscreen();
    $("panel").hidden = !open;
    $("launcher").hidden = open;
    $("launcher").setAttribute("aria-expanded", String(open));
    if (open) $("prompt").focus(); else $("launcher").focus();
  }
  function setExpanded(value) {
    expanded = value;
    $("panel").classList.toggle("fullscreen", value);
    $("fullscreen").textContent = value ? "退出全屏" : "全屏";
    $("fullscreen").setAttribute("aria-pressed", String(value));
    $("fullscreen").setAttribute("aria-label", value ? "退出 AI 助手全屏" : "全屏显示 AI 助手");
  }
  function leaveFullscreen() {
    setExpanded(false);
    if (document.fullscreenElement === host && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
  async function toggleFullscreen() {
    if (expanded) { leaveFullscreen(); return; }
    setExpanded(true);
    if (host.requestFullscreen && !document.fullscreenElement) {
      try { await host.requestFullscreen(); } catch { /* The panel still fills the game window. */ }
    }
  }
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === host) { nativeFullscreen = true; setExpanded(true); }
    else if (nativeFullscreen) { nativeFullscreen = false; setExpanded(false); $("fullscreen").focus(); }
  });
  function appendMarkdown(wrapper, text) {
    const content = document.createElement("div"); content.className = "markdown";
    if (!window.marked?.parse || !window.DOMPurify?.sanitize) {
      content.className = "content"; content.textContent = text; wrapper.append(content); return;
    }
    const html = window.marked.parse(String(text), { gfm: true, breaks: true });
    content.innerHTML = window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "em", "strong", "del", "s", "blockquote", "ul", "ol", "li", "pre", "code", "hr", "table", "thead", "tbody", "tr", "th", "td", "a", "input"],
      ALLOWED_ATTR: ["href", "title", "class", "start", "align", "type", "checked", "disabled"],
      ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    });
    for (const link of content.querySelectorAll("a")) {
      try {
        const url = new URL(link.getAttribute("href"));
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("unsupported link");
        link.target = "_blank"; link.rel = "noopener noreferrer";
      } catch { link.removeAttribute("href"); }
    }
    for (const input of content.querySelectorAll("input")) {
      if (input.type !== "checkbox") input.remove(); else input.disabled = true;
    }
    for (const table of content.querySelectorAll("table")) {
      const scroll = document.createElement("div"); scroll.className = "table-scroll"; table.replaceWith(scroll); scroll.append(table);
    }
    for (const pre of content.querySelectorAll("pre")) {
      const code = pre.querySelector("code"); if (!code) continue;
      const block = document.createElement("div"); block.className = "code-block";
      const heading = document.createElement("div"); heading.className = "code-heading";
      const language = document.createElement("span"); language.textContent = [...code.classList].find(name => name.startsWith("language-"))?.slice(9) || "代码";
      const copy = document.createElement("button"); copy.className = "copy"; copy.textContent = "复制代码";
      copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(code.textContent); copy.textContent = "已复制"; } catch { copy.textContent = "请选中代码复制"; } });
      heading.append(language, copy); pre.replaceWith(block); block.append(heading, pre);
    }
    wrapper.append(content);
  }
  function record(event) {
    if (!currentSession) return;
    currentSession.events.push(event); scheduleSave();
  }
  function addMessage(role, text, error = false, remember = true) {
    const wrapper = document.createElement("div");
    wrapper.className = "message " + (role === "你" ? "user" : "") + (error ? " error" : "");
    const label = document.createElement("span"); label.className = "role"; label.textContent = role; wrapper.append(label);
    if (role === "AI") appendMarkdown(wrapper, text);
    else { const content = document.createElement("div"); content.className = "content"; content.textContent = text; wrapper.append(content); }
    $("messages").append(wrapper); $("messages").scrollTop = $("messages").scrollHeight;
    if (remember) record({ kind: "message", role, text: String(text), error });
  }
  const labels = { get_state: "读取角色状态", scan_network: "扫描可达网络", get_server: "查看服务器", list_files: "列出脚本", read_file: "读取文件", get_api_help: "查询游戏 API", write_script: "保存脚本", run_script: "启动脚本", stop_script: "停止脚本" };
  function onEvent(event) {
    if (event.type === "round") $("activity").textContent = `AI 正在处理（第 ${event.round}/${event.limit} 轮）…`;
    if (event.type === "context") updateContextDisplay(event);
    if (event.type === "message") addMessage("AI", event.text);
    if (event.type === "working") $("activity").textContent = (labels[event.name] || event.name) + "…";
    if (event.type === "tool") addTool(event);
  }
  function addTool(event, remember = true) {
    const details = document.createElement("details"); details.className = "tool" + (event.ok ? "" : " error");
    const summary = document.createElement("summary"); summary.textContent = (event.ok ? "完成：" : "未完成：") + (labels[event.name] || event.name);
    const pre = document.createElement("pre"); pre.textContent = event.output; details.append(summary, pre); $("messages").append(details);
    $("messages").scrollTop = $("messages").scrollHeight;
    if (remember) record({ kind: "tool", name: event.name, output: event.output, ok: event.ok });
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { persistNow().catch(() => {}); }, 100);
  }
  function persistNow() {
    clearTimeout(saveTimer);
    if (!currentSession) return Promise.resolve();
    currentSession.groups = groups;
    const snapshot = JSON.parse(JSON.stringify(currentSession));
    storageQueue = storageQueue.catch(() => {}).then(() => bridge("session:save", snapshot));
    return storageQueue.then(summary => {
      if (currentSession?.id === summary.id) {
        currentSession.updatedAt = summary.updatedAt;
        const option = [...$("session-list").options].find(item => item.value === summary.id);
        if (option) option.textContent = summary.title;
      }
    }).catch(error => { $("activity").textContent = "会话保存失败：" + error.message; throw error; });
  }
  async function refreshSessions() {
    const state = await bridge("session:list");
    $("session-list").replaceChildren();
    for (const session of state.sessions) {
      const option = document.createElement("option"); option.value = session.id; option.textContent = session.title;
      $("session-list").append(option);
    }
    if (currentSession) $("session-list").value = currentSession.id;
    return state;
  }
  function chatHistory() {
    const recent = [...groups];
    while (recent.length > 0 && (recent.flat().length > 50 || JSON.stringify(recent).length > 100000)) recent.shift();
    return recent.flat();
  }
  const formatTokens = value => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(Math.max(0, value));
  function updateContextDisplay(data) {
    const limit = data.limit || contextWindow;
    const tokens = Math.max(0, data.tokens || 0);
    const percent = limit ? tokens / limit * 100 : 0;
    $("context-fill").style.width = Math.min(100, percent).toFixed(2) + "%";
    $("context-track").classList.toggle("over", percent >= 90);
    $("context-track").setAttribute("aria-valuenow", Math.min(100, percent).toFixed(1));
    $("context-track").setAttribute("aria-valuetext", `${data.source === "API" ? "实际" : "估算"} ${formatTokens(tokens)} / ${formatTokens(limit)} Token，${percent.toFixed(1)}%`);
    $("context-label").textContent = `上下文${data.source === "API" ? "实际" : "约"} ${formatTokens(tokens)}/${formatTokens(limit)} · ${percent.toFixed(1)}%`;
  }
  function refreshContextDisplay() {
    clearTimeout(contextRefreshTimer);
    contextRefreshTimer = setTimeout(() => {
      if (!currentSession) return;
      try {
        updateContextDisplay(window.BitburnerAIAgent.estimateContext({
          history: chatHistory(), draft: currentSession.pendingMessage || $("prompt").value,
          auto: $("mode").value === "auto", tools: game.tools($("mode").value === "auto"), contextWindow,
        }));
      } catch { /* Keep the last estimate while the game is loading. */ }
    }, 100);
  }
  async function compressCurrentContext() {
    if (busy || switching || !currentSession) return;
    switching = true; setBusy(false);
    try {
      const history = [...groups];
      const before = window.BitburnerAIAgent.estimateContext({ history: history.flat(), tools: game.tools($("mode").value === "auto"), auto: $("mode").value === "auto", contextWindow });
      const result = window.BitburnerAIAgent.compressHistory(history, 3, before.tokens > contextWindow * 0.72);
      if (!result.changed) { $("activity").textContent = "会话内容较短，暂时不需要压缩。"; return; }
      const after = window.BitburnerAIAgent.estimateContext({ history: result.history.flat(), draft: $("prompt").value, tools: game.tools($("mode").value === "auto"), auto: $("mode").value === "auto", contextWindow });
      if (after.tokens >= before.tokens) { $("activity").textContent = "当前历史内容较短，压缩无法减少上下文。"; return; }
      groups.splice(0, groups.length, ...result.history);
      addMessage("助手", `已压缩 ${result.removedTurns} 轮较早对话，保留任务目标与近期工具结果。预计上下文从 ${formatTokens(before.tokens)} 降至 ${formatTokens(after.tokens)} Token。`);
      updateContextDisplay(after);
      await persistNow(); await refreshSessions();
      $("activity").textContent = `上下文已压缩，预计使用 ${formatTokens(after.tokens)}/${formatTokens(contextWindow)} Token。`;
    } catch (error) { $("activity").textContent = "压缩失败：" + error.message; }
    finally { switching = false; setBusy(false); refreshContextDisplay(); }
  }
  async function useSession(session) {
    currentSession = session; groups.splice(0, groups.length, ...session.groups);
    $("messages").replaceChildren(); $("session-edit").hidden = true; $("prompt").value = session.draft || "";
    $("round-limit").value = String(session.maxRounds || 200);
    for (const event of session.events) {
      if (event.kind === "message") addMessage(event.role, event.text, event.error, false);
      else if (event.kind === "tool") addTool(event, false);
    }
    if (session.pending) {
      const note = "上次请求在游戏退出时中断，已保留对话记录。你可以重新发送目标继续。";
      if (session.pendingMessage) groups.push([{ role: "user", content: session.pendingMessage }, { role: "assistant", content: note }]);
      session.pending = false; session.pendingMessage = ""; addMessage("助手", note);
    }
    if (!session.events.length) addMessage("助手", "可以问我玩法、让你看懂脚本，或切到自动模式后直接说出游戏目标。先在“模型设置”填写接口地址和模型，再测试连接。");
    await persistNow(); await refreshSessions();
  }
  async function sessionAction(action) {
    if (busy || switching) return;
    switching = true; setBusy(busy);
    try { await persistNow(); await action(); }
    catch (error) { $("activity").textContent = error.message; }
    finally { switching = false; setBusy(busy); }
  }
  function setBusy(value) {
    busy = value;
    for (const id of ["send", "clear", "mode", "round-limit", "save", "test", "clear-key", "context-window", "compress-context", "session-list", "new-session", "rename-session", "delete-session", "undo-delete", "save-title"]) $(id).disabled = value || switching;
    $("kill").disabled = switching;
    $("stop").hidden = !value;
  }
  function showConfig(config) {
    $("base-url").value = config.baseUrl;
    $("model").value = config.model;
    contextWindow = config.contextWindow || 128000;
    $("context-window").value = String(contextWindow);
    $("api-key").value = "";
    $("api-key").placeholder = config.hasKey ? "已保存，留空保持" : "本机模型可留空";
    $("config-status").textContent = config.hasKey ? (config.encryptedStorage ? "密钥已加密保存" : "密钥仅用于当前会话") : "未设置密钥";
    if (!config.baseUrl || !config.model) $("settings").open = true;
  }
  async function saveConfig(clearKey = false) {
    const contextWindowValue = Number($("context-window").value);
    if (!Number.isSafeInteger(contextWindowValue) || contextWindowValue < 4096 || contextWindowValue > 2000000) {
      throw new Error("上下文窗口须为 4,096 到 2,000,000 之间的整数 Token。");
    }
    const config = await bridge("config:save", { baseUrl: $("base-url").value, model: $("model").value, apiKey: $("api-key").value, contextWindow: contextWindowValue, clearKey });
    showConfig(config); $("activity").textContent = "配置已保存，可以发送消息。"; return config;
  }
  async function send() {
    if (busy || switching || !currentSession) return;
    const message = $("prompt").value.trim();
    if (!message) { $("prompt").focus(); return; }
    if (message.length > 12000) { $("activity").textContent = "消息过长，请控制在 12000 字符内。"; return; }
    const auto = $("mode").value === "auto";
    addMessage("你", message); $("prompt").value = ""; setBusy(true); $("activity").textContent = "AI 正在处理…";
    if (currentSession.title === "新对话") currentSession.title = message.replace(/\s+/g, " ").slice(0, 28);
    currentSession.pending = true; currentSession.pendingMessage = message; currentSession.draft = "";
    controller = new AbortController();
    const recent = chatHistory();
    try {
      await persistNow();
      const maxRounds = Number(currentSession.maxRounds) || 200;
      const turn = await window.BitburnerAIAgent.run({ message, history: recent, auto, bridge, game, onEvent, signal: controller.signal, maxRounds, contextWindow });
      groups.push(turn); $("activity").textContent = "本轮完成。";
    } catch (error) {
      groups.push([{ role: "user", content: message }, { role: "assistant", content: "本轮未完成：" + error.message }]);
      addMessage("助手", error.message, true); $("activity").textContent = error.name === "AbortError" ? "本轮已停止。已运行的脚本可用上方按钮停止。" : "本轮未完成。";
    } finally {
      currentSession.pending = false; currentSession.pendingMessage = "";
      await persistNow().catch(() => {}); await refreshSessions().catch(() => {});
      controller = null; setBusy(false);
    }
  }
  $("launcher").addEventListener("click", () => toggle(true));
  $("close").addEventListener("click", () => toggle(false));
  $("fullscreen").addEventListener("click", toggleFullscreen);
  $("send").addEventListener("click", send);
  $("prompt").addEventListener("keydown", event => { if (!event.isComposing && event.keyCode !== 229 && event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); send(); } });
  $("prompt").addEventListener("input", refreshContextDisplay);
  function handleShortcut(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if (expanded && event.key === "Tab") {
      const focusable = [...$("panel").querySelectorAll("button,input,textarea,select,summary,a[href]")].filter(element => {
        if (element.disabled || element.closest("[hidden]")) return false;
        for (let parent = element.parentElement; parent && parent !== $("panel"); parent = parent.parentElement) {
          if (parent.tagName === "DETAILS" && !parent.open && element.tagName !== "SUMMARY") return false;
        }
        return true;
      });
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (first && event.shiftKey && shadow.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (last && !event.shiftKey && shadow.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if (event.ctrlKey && event.shiftKey && event.code === "KeyA") { event.preventDefault(); toggle($("panel").hidden); }
    if (event.key === "Escape" && !$("panel").hidden) { event.preventDefault(); if (expanded) leaveFullscreen(); else toggle(false); }
  }
  // Game document handlers see a shadow host instead of the focused input.
  // Keep the panel's events inside its boundary while preserving native input defaults.
  shadow.addEventListener("keydown", event => { handleShortcut(event); event.stopPropagation(); });
  for (const type of ["keyup", "keypress", "beforeinput", "input", "compositionstart", "compositionupdate", "compositionend", "copy", "cut", "paste"]) {
    shadow.addEventListener(type, event => event.stopPropagation());
  }
  document.addEventListener("keydown", handleShortcut);
  $("round-limit").addEventListener("change", () => {
    const value = Number($("round-limit").value);
    if (!Number.isSafeInteger(value) || value < 1 || value > 1000) {
      $("round-limit").value = String(currentSession?.maxRounds || 200);
      $("activity").textContent = "每轮循环上限须为 1 到 1,000 之间的整数。";
      return;
    }
    if (currentSession) { currentSession.maxRounds = value; scheduleSave(); }
    $("activity").textContent = `下一轮最多执行 ${value} 次模型循环。`;
  });
  $("compress-context").addEventListener("click", compressCurrentContext);
  $("prompt").addEventListener("input", () => { if (currentSession) { currentSession.draft = $("prompt").value; scheduleSave(); } });
  $("new-session").addEventListener("click", () => sessionAction(async () => { await useSession(await bridge("session:create")); $("prompt").focus(); }));
  $("session-list").addEventListener("change", () => { const id = $("session-list").value; sessionAction(async () => { await useSession(await bridge("session:get", { id })); }); });
  $("rename-session").addEventListener("click", () => { $("session-edit").hidden = false; $("session-title").value = currentSession?.title || ""; $("session-title").focus(); $("session-title").select(); });
  $("cancel-title").addEventListener("click", () => { $("session-edit").hidden = true; });
  $("save-title").addEventListener("click", () => sessionAction(async () => {
    const title = $("session-title").value.trim(); if (!title) throw new Error("会话名称不能为空。");
    currentSession.title = title; await persistNow(); await refreshSessions(); $("session-edit").hidden = true;
  }));
  $("delete-session").addEventListener("click", () => sessionAction(async () => {
    const id = currentSession.id; await bridge("session:delete", { id }); deletedSession = id;
    const state = await bridge("session:list");
    await useSession(state.activeId ? await bridge("session:get", { id: state.activeId }) : await bridge("session:create"));
    $("undo-delete").hidden = false; $("activity").textContent = "会话已删除，可以撤销。";
  }));
  $("undo-delete").addEventListener("click", () => sessionAction(async () => {
    if (!deletedSession) return;
    await bridge("session:restore", { id: deletedSession }); await useSession(await bridge("session:get", { id: deletedSession }));
    deletedSession = null; $("undo-delete").hidden = true; $("activity").textContent = "会话已恢复。";
  }));
  $("stop").addEventListener("click", () => { controller?.abort(); bridge("cancel").catch(() => {}); $("activity").textContent = "正在停止…"; });
  $("clear").addEventListener("click", () => { groups.length = 0; if (currentSession) currentSession.events = []; $("messages").replaceChildren(); scheduleSave(); $("activity").textContent = "当前会话已清空。"; });
  $("mode").addEventListener("change", () => { $("activity").textContent = $("mode").value === "auto" ? "自动模式会按你的目标保存并运行游戏脚本。" : "讲解模式可以读取状态、解释玩法和生成代码。"; refreshContextDisplay(); });
  $("config-form").addEventListener("submit", async event => { event.preventDefault(); try { await saveConfig(); } catch (error) { $("config-status").textContent = error.message; } });
  $("clear-key").addEventListener("click", async () => { try { await saveConfig(true); } catch (error) { $("config-status").textContent = error.message; } });
  $("test").addEventListener("click", async () => {
    setBusy(true); controller = new AbortController();
    try { await saveConfig(); $("config-status").textContent = "连接测试中…"; await bridge("test"); $("config-status").textContent = "连接成功"; }
    catch (error) { $("config-status").textContent = error.message; }
    finally { controller = null; setBusy(false); }
  });
  $("kill").addEventListener("click", async () => {
    controller?.abort(); await bridge("cancel").catch(() => {});
    try {
      const state = await game.execute("get_state");
      const scripts = state.running.filter(script => script.aiStarted);
      for (const script of scripts) await game.execute("stop_script", { pid: script.pid }, true);
      addMessage("助手", scripts.length ? `已停止 ${scripts.length} 个 AI 启动的脚本。` : "当前没有本次会话中由 AI 启动的脚本。");
    } catch (error) { addMessage("助手", error.message, true); }
  });
  function updateStatus() { $("game-status").textContent = game?.ready() ? "游戏已连接" : "等待游戏加载"; }
  updateStatus(); const statusTimer = setInterval(updateStatus, 3000);
  window.addEventListener("beforeunload", () => { clearInterval(statusTimer); persistNow().catch(() => {}); controller?.abort(); bridge("cancel").catch(() => {}); });
  setBusy(false);
  (async () => {
    try {
      const [config, state] = await Promise.all([bridge("config:get"), bridge("session:list")]);
      showConfig(config);
      await useSession(state.activeId ? await bridge("session:get", { id: state.activeId }) : await bridge("session:create"));
      refreshContextDisplay();
      if (config.baseUrl && config.model) $("activity").textContent = "会话已恢复，模型配置已加载。";
    } catch (error) { $("settings").open = true; $("config-status").textContent = error.message + " 请完全退出并重启游戏。"; }
    finally { switching = false; setBusy(false); }
  })();
})();
