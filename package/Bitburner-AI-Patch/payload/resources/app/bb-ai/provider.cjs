"use strict";

function endpoint(baseUrl) {
  const url = new URL(String(baseUrl || "").trim());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("模型地址请使用 HTTPS；本机服务可以使用 HTTP。");
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("模型地址不能包含账号、查询参数或锚点。");
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (!url.pathname.endsWith("/chat/completions")) url.pathname += "/chat/completions";
  return url.href;
}

function validateConfig(value) {
  if (!value || typeof value !== "object") throw new Error("配置格式无效。");
  const baseUrl = String(value.baseUrl || "").trim();
  endpoint(baseUrl);
  const model = String(value.model || "").trim();
  if (!model || model.length > 200) throw new Error("请填写模型名称。");
  const contextWindow = value.contextWindow === undefined ? 128000 : value.contextWindow;
  if (!Number.isSafeInteger(contextWindow) || contextWindow < 4096 || contextWindow > 2000000) {
    throw new Error("上下文窗口需设置为 4,096 到 2,000,000 之间的整数 Token。");
  }
  return { baseUrl, model, contextWindow };
}

function cleanError(error, key) {
  let message = String(error?.message || error || "请求失败");
  if (key) message = message.split(key).join("[已隐藏密钥]");
  return message.slice(0, 600);
}

async function complete(config, request, fetchImpl, signal) {
  const checked = validateConfig(config);
  if (!Array.isArray(request.messages) || request.messages.length > 100) throw new Error("对话过长，请清空对话后再试。");
  const body = { model: checked.model, messages: request.messages, stream: false };
  if (request.tools?.length) { body.tools = request.tools; body.tool_choice = "auto"; }
  const serialized = JSON.stringify(body);
  if (serialized.length > 300000) throw new Error("对话内容过大，请清空对话后再试。");
  const headers = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const response = await fetchImpl(endpoint(checked.baseUrl), {
    method: "POST", headers, body: serialized, signal, redirect: "error",
  });
  const raw = await response.text();
  if (raw.length > 4000000) throw new Error("模型返回内容过大。");
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error(`服务返回了非 JSON 内容（HTTP ${response.status}），请检查接口地址。`); }
  if (!response.ok) throw new Error(`HTTP ${response.status}：${data.error?.message || data.message || "模型请求失败"}`);
  const message = data.choices?.[0]?.message;
  if (!message || (!message.content && !message.tool_calls?.length)) throw new Error("服务没有返回可用的对话内容，请检查模型与接口是否兼容。");
  const result = { role: "assistant", content: message.content || null };
  if (Number.isSafeInteger(data.usage?.prompt_tokens) && data.usage.prompt_tokens >= 0) {
    result.usage = { prompt_tokens: data.usage.prompt_tokens };
  }
  if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
    if (message.tool_calls.length > 12) throw new Error("单次工具调用过多，请将任务拆小。");
    result.tool_calls = message.tool_calls.map(call => {
      if (!call.id || call.type !== "function" || !call.function?.name || typeof call.function.arguments !== "string") {
        throw new Error("模型返回了无效的工具调用。");
      }
      return { id: call.id, type: "function", function: { name: call.function.name, arguments: call.function.arguments } };
    });
  }
  // Some compatible reasoning models require this field on subsequent tool turns.
  if (typeof message.reasoning_content === "string") result.reasoning_content = message.reasoning_content;
  return result;
}

module.exports = { endpoint, validateConfig, cleanError, complete };
