/* eslint-disable @typescript-eslint/no-var-requires */
const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronBridge", {
  send: (channel, data) => {
    // whitelist channels
    let validChannels = [
      "get-save-data-response",
      "get-save-info-response",
      "push-game-saved",
      "push-game-ready",
      "push-import-result",
      "push-disable-restore",
      "activate-achievements",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = [
      "get-save-data-request",
      "get-save-info-request",
      "push-save-request",
      "trigger-save",
      "trigger-game-export",
      "trigger-scripts-export",
    ];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});

// Bitburner AI assistant: credentials stay in the main process.
contextBridge.exposeInMainWorld("BitburnerAIBridge", {
  request: (method, value) => {
    if (!["config:get", "config:save", "chat", "test", "cancel", "session:list", "session:create", "session:get", "session:save", "session:delete", "session:restore"].includes(method)) return Promise.reject(new Error("Unsupported assistant operation"));
    return ipcRenderer.invoke("bitburner-ai:request", method, value);
  },
});
