(function () {
  "use strict";
  // These exports are pinned to the verified Steam 3.0.1 build. No game bundle is rewritten.
  let requireGame;
  let backupCounter = 0;
  const started = new Set();
  function connect() {
    if (!requireGame) {
      const chunks = window.webpackChunkbitburner;
      if (!chunks?.push) throw new Error("游戏还在加载，请稍后重试。");
      chunks.push([["bitburner-ai-" + Date.now()], {}, req => { requireGame = req; }]);
    }
    if (!requireGame) throw new Error("无法连接当前游戏版本。");
    const player = requireGame(576191).ai;
    if (!player?.getHomeComputer) throw new Error("游戏存档还未加载完成。");
    const server = requireGame(47657).mC;
    const rfa = requireGame(970557).D;
    const workers = requireGame(64882);
    const tutorial = requireGame(919946).OZ;
    if (typeof server !== "function" || !rfa?.pushFile || typeof workers.CV !== "function" || typeof workers.Oc !== "function") {
      throw new Error("游戏版本不兼容，请停用 AI 插件。");
    }
    return { player, server, rfa, workers, tutorial };
  }
  function network(game) {
    const seen = new Set();
    const queue = ["home"];
    for (let i = 0; i < queue.length && i < 1000; i++) {
      const host = queue[i];
      if (seen.has(host)) continue;
      const server = game.server(host);
      if (!server) continue;
      seen.add(host);
      for (const next of server.serversOnNetwork || []) if (!seen.has(next)) queue.push(next);
    }
    return seen;
  }
  function info(server) {
    return {
      hostname: server.hostname, root: server.hasAdminRights, purchased: server.purchasedByPlayer,
      ram: { total: server.maxRam, used: server.ramUsed, free: Math.max(0, server.maxRam - server.ramUsed) },
      money: server.moneyAvailable, maxMoney: server.moneyMax, security: server.hackDifficulty,
      minSecurity: server.minDifficulty, requiredHacking: server.requiredHackingSkill,
      portsRequired: server.numOpenPortsRequired, openPorts: server.openPortCount,
      neighbors: server.serversOnNetwork,
    };
  }
  function running(server) {
    const rows = [];
    for (const group of server.runningScriptMap.values()) for (const script of group.values()) {
      rows.push({ pid: script.pid, filename: script.filename, threads: script.threads, args: script.args, ram: script.ramUsage * script.threads, aiStarted: started.has(script.pid) });
    }
    return rows;
  }
  function filename(value, write = false) {
    const name = String(value || "").replace(/^\//, "");
    if (!/^[A-Za-z0-9_./-]+\.(js|jsx|ts|tsx|txt)$/.test(name) || name.split("/").some(part => !part || part === "." || part === "..")) {
      throw new Error("文件名无效。");
    }
    if (write && (!name.startsWith("ai/") || !/\.(js|jsx|ts|tsx)$/.test(name))) throw new Error("AI 脚本请保存到 ai/ 目录，例如 ai/hack.js。");
    return name;
  }
  async function rfa(game, method, params) {
    const result = await game.rfa[method]({ jsonrpc: "2.0", id: 1, params });
    if (result.error) throw new Error(result.error);
    return result.result;
  }
  const writeTools = new Set(["write_script", "run_script", "stop_script"]);
  async function execute(name, args = {}, auto = false) {
    if (writeTools.has(name) && !auto) throw new Error("请切换到“自动部署与运行”模式后执行。");
    const game = connect();
    const home = game.player.getHomeComputer();
    if (name === "get_state") return {
      version: "3.0.1", money: game.player.money, city: game.player.city, skills: game.player.skills,
      hp: game.player.hp, factions: game.player.factions, jobs: game.player.jobs,
      programs: home.programs || [],
      tutorialRunning: game.tutorial.isRunning, home: info(home), running: running(home),
    };
    if (name === "scan_network") return [...network(game)].map(host => info(game.server(host)));
    if (name === "get_server") {
      const host = String(args.host || "home");
      if (!network(game).has(host)) throw new Error("服务器尚未出现在可达网络中。");
      const server = game.server(host);
      return { ...info(server), running: server.hasAdminRights ? running(server) : [] };
    }
    if (name === "list_files") return rfa(game, "getFileNames", { server: "home" });
    if (name === "read_file") return (await rfa(game, "getFile", { server: "home", filename: filename(args.filename) })).slice(0, 24000);
    if (name === "get_script_logs") {
      for (const group of home.runningScriptMap.values()) for (const script of group.values()) {
        if (script.pid === args.pid) return { pid: script.pid, filename: script.filename, logs: script.logs.slice(-40).map(line => typeof line === "string" ? line : "[非文本日志]") };
      }
      throw new Error("脚本已经停止或 PID 不存在。");
    }
    if (name === "get_api_help") {
      const query = String(args.query || "").trim();
      if (query.length < 2 || query.length > 80) throw new Error("请输入 2–80 个字符的 API 名称。");
      const definition = await rfa(game, "getDefinitionFile", {});
      const lines = definition.split("\n");
      const needle = query.replace(/^ns\./, "").toLowerCase();
      const matches = [];
      for (let i = 0; i < lines.length && matches.length < 3; i++) {
        if (lines[i].toLowerCase().includes(needle)) matches.push(lines.slice(Math.max(0, i - 12), i + 22).join("\n"));
      }
      return matches.join("\n---\n").slice(0, 14000) || "未找到，请尝试更短的函数名。";
    }
    if (name === "write_script") {
      const file = filename(args.filename, true);
      const content = String(args.content || "");
      if (!content.trim() || content.length > 60000) throw new Error("脚本不能为空，且不得超过 60000 字符。");
      const existing = home.scripts.get(file);
      let backup;
      if (existing) {
        backup = `ai/backups/${file.slice(3).replace(/\//g, "_")}-${Date.now()}-${++backupCounter}.txt`;
        await rfa(game, "pushFile", { server: "home", filename: backup, content: existing.content });
      }
      await rfa(game, "pushFile", { server: "home", filename: file, content });
      const script = home.scripts.get(file);
      const ram = script?.getRamUsage(home.scripts);
      return { filename: file, backup, ramPerThread: ram, error: script?.ramCalculationError || null, saved: true };
    }
    if (name === "run_script") {
      if (game.tutorial.isRunning) throw new Error("请先完成或退出游戏教程，再运行 AI 脚本。");
      const file = filename(args.filename, true);
      const threads = args.threads === undefined ? 1 : args.threads;
      const scriptArgs = args.args === undefined ? [] : args.args;
      if (!Number.isSafeInteger(threads) || threads < 1 || threads > 1000000) throw new Error("线程数必须是正整数。");
      if (!Array.isArray(scriptArgs) || scriptArgs.length > 30 || scriptArgs.some(arg => !["string", "number", "boolean"].includes(typeof arg) || (typeof arg === "number" && !Number.isFinite(arg)))) {
        throw new Error("脚本参数只能使用字符串、有限数字或布尔值。");
      }
      const duplicate = running(home).find(script => script.filename === file && JSON.stringify(script.args) === JSON.stringify(scriptArgs));
      if (duplicate) return { pid: duplicate.pid, alreadyRunning: true };
      const result = game.workers.Oc(home, file, { threads, temporary: false, preventDuplicates: true }, scriptArgs);
      if (!result.success) throw new Error(result.message);
      result.runningScript.threads = threads;
      const pid = game.workers.CV(result.runningScript, home);
      if (!pid) throw new Error("游戏未能启动脚本，请检查活动脚本与终端消息。");
      started.add(pid);
      return { pid, filename: file, threads, started: true };
    }
    if (name === "stop_script") {
      const script = running(home).find(row => row.pid === args.pid);
      if (!script || !started.has(script.pid)) throw new Error("只能停止本次游戏会话中由 AI 助手启动的脚本。");
      if (game.tutorial.isRunning) throw new Error("教程期间暂不能停止脚本。");
      const stopped = requireGame(251130).MM(script.pid);
      if (stopped) started.delete(script.pid);
      return { pid: script.pid, stopped };
    }
    throw new Error("未知的游戏工具：" + name);
  }
  function tool(name, description, properties = {}, required = []) {
    return { type: "function", function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } } };
  }
  const str = description => ({ type: "string", description });
  const tools = [
    tool("get_state", "读取当前玩家属性、资金、home 内存与运行中脚本。"),
    tool("scan_network", "查看从 home 可达的服务器及其资金、安全等级、端口和 RAM。"),
    tool("get_server", "查看一个可达服务器的信息。", { host: str("服务器名，例如 n00dles") }, ["host"]),
    tool("list_files", "列出游戏 home 服务器中的脚本与文本文件。"),
    tool("read_file", "读取 home 的脚本或文本。", { filename: str("游戏内文件名") }, ["filename"]),
    tool("get_script_logs", "读取一个仍在 home 运行的脚本的最近日志，便于调试。", { pid: { type: "integer" } }, ["pid"]),
    tool("get_api_help", "搜索当前 3.0.1 游戏的 Netscript 类型文档。", { query: str("函数名，如 hack、getServer、scan") }, ["query"]),
    tool("write_script", "在 home 的 ai/ 目录保存 JS/TS 脚本，覆盖前自动备份。返回实际 RAM 消耗与编译错误。", { filename: str("例如 ai/hack.js"), content: str("完整脚本代码") }, ["filename", "content"]),
    tool("run_script", "在 home 运行 ai/ 下的脚本，使用游戏正常的权限和 RAM 检查。", { filename: str("例如 ai/hack.js"), threads: { type: "integer", minimum: 1 }, args: { type: "array", items: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] } } }, ["filename"]),
    tool("stop_script", "停止当前会话中由 AI 助手启动的一个脚本。", { pid: { type: "integer" } }, ["pid"]),
  ];
  window.BitburnerAI = Object.freeze({ execute, tools: auto => tools.filter(item => auto || !writeTools.has(item.function.name)), ready: () => { try { connect(); return true; } catch { return false; } } });
})();
