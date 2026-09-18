import { app, BrowserWindow, dialog, shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.FAROL_PORT || 8788);
const host = "127.0.0.1";
const packaged = process.env.FAROL_PACKAGED === "1";
const useVite = !packaged || !existsSync(path.join(rootDir, "dist", "index.html"));
const uiPort = useVite ? 5174 : port;
const startPath = process.env.FAROL_START || "/painel/upload";
const uiUrl = `http://${host}:${uiPort}${startPath}`;
const probeUrl = `http://${host}:${port}/api/status`;

const children = [];
let quitting = false;
let mainWindow = null;

function spawnChild(command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      FAROL_HOST: host,
      FAROL_PORT: String(port),
      FAROL_DESKTOP: "1",
    },
    shell: true,
    windowsHide: true,
    stdio: "inherit",
  });
  children.push(child);
  child.on("exit", (code) => {
    const index = children.indexOf(child);
    if (index >= 0) children.splice(index, 1);
    if (!quitting && code && code !== 0) {
      console.error(`${command} exited with code ${code}`);
    }
  });
  return child;
}

async function spawnStack() {
  const backendAlive = await fetch(`http://${host}:${port}/api/status`).then(r => r.ok || r.status === 401).catch(() => false);
  if (!backendAlive) {
    spawnChild("npx", ["tsx", "server/index.ts"]);
  } else {
    console.log(`[Electron] Backend já ativo na porta ${port}. Reutilizando.`);
  }

  if (useVite) {
    const viteAlive = await fetch(`http://${host}:${uiPort}/`).then(r => r.ok || r.status < 500).catch(() => false);
    if (!viteAlive) {
      spawnChild("npx", ["vite", "--host", host, "--port", String(uiPort)]);
    } else {
      console.log(`[Electron] Vite já ativo na porta ${uiPort}. Reutilizando.`);
    }
  }
}

async function waitForReady(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const backend = await fetch(probeUrl).catch(() => null);
      const vite = useVite ? await fetch(`http://${host}:${uiPort}/`).catch(() => null) : { ok: true };
      if (backend && (backend.ok || backend.status === 401) && vite && (vite.ok || vite.status < 500)) {
        return;
      }
    } catch {
      /* still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error("O Farol não subiu a tempo. Fecha qualquer npm run dev antigo e tenta de novo.");
}

function createWindow() {
  console.log("Criando janela do Electron Farol em:", uiUrl);
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "Farol",
    backgroundColor: "#02010A",
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(rootDir, "desktop", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error(`[Electron] Falha ao carregar ${uiUrl}: ${code} (${desc})`);
    setTimeout(() => {
      if (mainWindow) mainWindow.loadURL(uiUrl);
    }, 1500);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log(`[Electron] Página carregada com sucesso: ${uiUrl}`);
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.loadURL(uiUrl);
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 3000);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopStack() {
  for (const child of [...children]) {
    if (!child.pid) continue;
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { windowsHide: true });
    } else {
      child.kill("SIGTERM");
    }
  }
  children.length = 0;
}

app.whenReady().then(async () => {
  await spawnStack();
  try {
    await waitForReady();
    createWindow();
  } catch (error) {
    dialog.showErrorBox("Farol", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on("before-quit", () => {
  quitting = true;
  stopStack();
});

app.on("window-all-closed", () => {
  quitting = true;
  stopStack();
  app.quit();
});
