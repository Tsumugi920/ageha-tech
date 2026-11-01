/**
 * 本地视觉验收：通过 Chrome DevTools Protocol 连接真实 GPU 渲染的页面，
 * 等待 3D 世界就绪、可选执行操作，然后截图 / 采样 FPS / 收集控制台错误。
 *
 * 用法：
 *   node scripts/capture-world.mjs --out screenshots/x.png --width 1440 --height 900
 *   node scripts/capture-world.mjs --width 390 --height 844 --mobile --dismiss
 *   node scripts/capture-world.mjs --walk 2200 --dismiss
 *   node scripts/capture-world.mjs --key KeyE --wait 1200 --out screenshots/detail.png
 *   node scripts/capture-world.mjs --key Digit1 --post-walk 1200 --out screenshots/close.png
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const out = option("out", "screenshots/r2-live.png");
const width = Number(option("width", 1440));
const height = Number(option("height", 900));
const mobile = flag("mobile");
const dsf = Number(option("dsf", 1));
const dismiss = flag("dismiss");
const walk = Number(option("walk", 0));
const strafe = Number(option("strafe", 0));
const key = option("key", null);
const keys = option("keys", null);
const clicks = option("clicks", null);
const waitMs = Number(option("wait", 1800));
const postWalk = Number(option("post-walk", 0));
const url = option("url", "http://localhost:3000");
const port = Number(option("port", 9222));
const noNavigate = flag("no-navigate");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url.includes("localhost")) ?? targets.find((item) => item.type === "page");
if (!target) throw new Error("没有可用的页面目标；请先启动带 --remote-debugging-port 的 Chrome");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    errors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text ?? "exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
  }
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression, awaitPromise = false) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable").catch(() => {});
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: dsf,
  mobile,
  screenWidth: width,
  screenHeight: height,
});
await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 }).catch(() => {});
const debugUrl = url.includes("?") ? `${url}&debug=1` : `${url}?debug=1`;
if (!noNavigate) {
  await send("Page.navigate", { url: debugUrl });
}
await send("Page.bringToFront").catch(() => {});
// R4：强制页面活跃。遮挡 / 后台时 document.hidden=true，rAF 会被浏览器
// 暂停，旧脚本会把挂起时长算成极低 FPS（R3 的 5.3 FPS 即此假象）。
await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
await send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});
await send("Emulation.setIdleOverride", {
  isUserActive: true,
  isScreenUnlocked: true,
}).catch(() => {});

// 等待世界就绪（WebGL + ResizeObserver + 首帧）
let phase = "loading";
for (let i = 0; i < 80; i += 1) {
  await sleep(250);
  phase = await evaluate(`document.querySelector('#world-root')?.dataset.worldPhase ?? 'loading'`).catch(() => "loading");
  if (phase === "ready") break;
}

await sleep(900);
// 只统计世界就绪之后的运行时错误（导航/热更新卸载旧根属于开发态噪声）
errors.length = 0;

if (dismiss) {
  await evaluate(`document.querySelector('.world-toast__close')?.click(); true;`).catch(() => {});
  await sleep(350);
}

if (flag("close-panel")) {
  await evaluate(`document.querySelector('[data-world-panel="detail"] .world-panel__close')?.click(); document.querySelector('[data-world-panel="nav"] .world-panel__close')?.click(); true;`).catch(() => {});
  await sleep(400);
}

if (walk > 0) {
  const press = (type, code, keyValue, virtualKey) =>
    send("Input.dispatchKeyEvent", {
      type,
      code,
      key: keyValue,
      windowsVirtualKeyCode: virtualKey,
      nativeVirtualKeyCode: virtualKey,
    });
  await press("keyDown", "KeyW", "w", 87);
  await sleep(walk);
  await press("keyUp", "KeyW", "w", 87);
  await sleep(500);
}

if (strafe > 0) {
  const press = (type) =>
    send("Input.dispatchKeyEvent", {
      type,
      code: "KeyD",
      key: "d",
      windowsVirtualKeyCode: 68,
      nativeVirtualKeyCode: 68,
    });
  await press("keyDown");
  await sleep(strafe);
  await press("keyUp");
  await sleep(500);
}

if (keys) {
  for (const code of keys.split(",").map((v) => v.trim()).filter(Boolean)) {
    const mapping = {
      KeyE: [69, "e"],
      KeyM: [77, "m"],
      KeyH: [72, "h"],
      KeyR: [82, "r"],
      Digit1: [49, "1"],
      Digit2: [50, "2"],
      Digit3: [51, "3"],
      Escape: [27, "Escape"],
    };
    const [virtualKey, keyValue] = mapping[code] ?? [0, code];
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      code,
      key: keyValue,
      windowsVirtualKeyCode: virtualKey,
      nativeVirtualKeyCode: virtualKey,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      code,
      key: keyValue,
      windowsVirtualKeyCode: virtualKey,
      nativeVirtualKeyCode: virtualKey,
    });
    await sleep(Number(option("keysGap", 700)));
  }
}

if (clicks) {
  for (const selector of clicks.split(",").map((v) => v.trim()).filter(Boolean)) {
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)})?.click(); true;`,
    ).catch(() => {});
    await sleep(Number(option("clickGap", 500)));
  }
}

if (key) {
  const keyMap = {
    KeyE: [69, "e"],
    KeyM: [77, "m"],
    KeyH: [72, "h"],
    KeyR: [82, "r"],
    Digit1: [49, "1"],
    Digit2: [50, "2"],
    Digit3: [51, "3"],
  };
  const [virtualKey, keyValue] = keyMap[key] ?? [0, key];
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    code: key,
    key: keyValue,
    windowsVirtualKeyCode: virtualKey,
    nativeVirtualKeyCode: virtualKey,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code: key,
    key: keyValue,
    windowsVirtualKeyCode: virtualKey,
    nativeVirtualKeyCode: virtualKey,
  });
  await sleep(waitMs);
}

if (postWalk > 0) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown", code: "KeyW", key: "w",
    windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87,
  });
  await sleep(postWalk);
  await send("Input.dispatchKeyEvent", {
    type: "keyUp", code: "KeyW", key: "w",
    windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87,
  });
  await sleep(600);
}

await sleep(waitMs);

const fps = await evaluate(
  `new Promise((resolve) => { let frames = 0; const start = performance.now(); const tick = () => { frames += 1; if (performance.now() - start < 2500) requestAnimationFrame(tick); else resolve(Math.round((frames / ((performance.now() - start) / 1000)) * 10) / 10); }; requestAnimationFrame(tick); })`,
  true,
).catch(() => null);

const info = await evaluate(`(() => {
  const canvas = document.querySelector('.world-canvas canvas');
  const root = document.querySelector('#world-root');
  return {
    phase: root?.dataset.worldPhase ?? null,
    canvas: canvas ? { width: canvas.width, height: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight } : null,
    dpr: window.devicePixelRatio,
    toastOpen: Boolean(document.querySelector('.world-toast')),
    brandDockVisible: (() => {
      const el = document.querySelector('.world-brand--dock');
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.opacity !== '0' && style.visibility !== 'hidden';
    })(),
    issuesBadge: Boolean(document.querySelector('nextjs-portal')),
    zone: document.querySelector('.world-hud__zone')?.textContent ?? null,
  };
})()`);

const state = await evaluate(`window.__AGEHA_WORLD_STATE__ ? window.__AGEHA_WORLD_STATE__() : null`).catch(() => null);
const render = await evaluate(`window.__AGEHA_WORLD_INFO__ ? window.__AGEHA_WORLD_INFO__() : null`).catch(() => null);

await mkdir(path.dirname(out), { recursive: true });
const screenshot = await send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  captureBeyondViewport: false,
});
await writeFile(out, Buffer.from(screenshot.data, "base64"));

console.log(JSON.stringify({ out, phase: info.phase, fps, info, state, render, errors }, null, 2));
socket.close();
