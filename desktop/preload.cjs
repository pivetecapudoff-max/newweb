const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("farolDesktop", {
  app: true,
});
