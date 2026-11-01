/**
 * R11.6 C 径视觉重构验收截图：
 * 8 个验收机位（真实首页初始 + 主岛三视角 + C 径三景 + 玩家通行），
 * 支持 --tag before/after 同机位对照。
 *
 * 用法（需先启动 dev server 与带 --remote-debugging-port=9222 的 Chrome）：
 *   node scripts/capture-r116.mjs --tag before
 *   node scripts/capture-r116.mjs --tag after
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(`--${key}`) ? args[args.indexOf(`--${key}`) + 1] : fallback;
const tag = option("tag", "after");
const url = option("url", "http://localhost:3457");
const directory = option("out", `.r11-shots/r116-${tag}`);
const port = Number(option("port", 9222));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 验收机位（?cam=pos.x,pos.y,pos.z,look.x,look.y,look.z） */
const POSES = {
  // 1 首页初始：不加 ?cam，走真实跟随相机
  "02-island-front": "3,4.5,44, 0,1.5,0",
  // 3 主岛侧面（西侧）：同框看到主岛轮廓与 C 径全程
  "03-island-side-west": "-52,7,12, 2,1,-2",
  // 4 主岛俯视
  "04-island-topdown": "0.01,62,8, 0,0,0",
  // 5 C 径近景：主岛西缘看第一段踏板
  "05-c-near": "-10.5,2.8,8.5, -24,0.4,10.5",
  // 6 C 径中景：海上看爬升段
  "06-c-mid": "-28,6.5,10, -50,5.5,26",
  // 7 C 径远景：R11.5 的 b0 西侧低机位复现（问题机位）
  "07-c-far-b0": "-40,-3.5,8, -6,2,-4",
};

const sleepFrames = (count = 90) => pageEval(`new Promise(resolve => { let n = 0; const tick = () => ++n >= ${count} ? resolve(true) : requestAnimationFrame(tick); tick(); })`);

let socket;
let id = 0;
const pending = new Map();
const errors = [];

function wire(socket) {
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.executionContextsCleared") errors.length = 0;
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") {
      errors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text ?? "exception");
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
    }
  };
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${method} timed out`)); }, 120000);
  pending.set(requestId, { resolve, reject, timer });
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
function pageEval(expression) { return evaluate(expression); }

const keyMap = { KeyW: ["w", 87], KeyA: ["a", 65], KeyS: ["s", 83], KeyD: ["d", 68], KeyR: ["r", 82] };
async function hold(code, ms) {
  const [key, keyCode] = keyMap[code];
  const params = { code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  await sleep(ms);
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
  await sleep(400);
}
async function drag(dx, dy, steps = 12) {
  const x0 = 720, y0 = 450;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= steps; i += 1) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x0 + (dx * i) / steps,
      y: y0 + (dy * i) / steps,
      button: "left",
      buttons: 1,
    });
    await sleepFrames(1);
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x0 + dx, y: y0 + dy, button: "left", buttons: 0, clickCount: 1 });
  await sleepFrames(8);
}

async function openWorld(extraQuery) {
  await send("Page.navigate", { url: `${url}/?debug=1&tier=high${extraQuery ?? ""}` });
  await send("Page.bringToFront");
  await evaluate(`new Promise((resolve, reject) => {
    const start = performance.now();
    const check = () => {
      if (document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && window.__AGEHA_WORLD_INFO__) resolve(true);
      else if (performance.now() - start > 90000) reject(new Error('World readiness timeout'));
      else requestAnimationFrame(check);
    }; check();
  })`);
  await sleepFrames(110);
  await evaluate(`document.querySelector('.world-toast__close')?.click()`);
  await evaluate(`document.querySelector('.world-hud__hint-close')?.click()`);
  await evaluate(`(() => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal{display:none!important}';
    document.head.appendChild(style);
    return true;
  })()`);
  await sleepFrames(25);
}

async function capture(name) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const file = path.join(directory, `${name}.png`);
  await writeFile(file, Buffer.from(result.data, "base64"));
  const state = await evaluate(`window.__AGEHA_WORLD_STATE__ ? window.__AGEHA_WORLD_STATE__() : null`).catch(() => null);
  console.log(`${name}: ${file}  cam=(${state?.camera?.x?.toFixed(1)},${state?.camera?.y?.toFixed(1)},${state?.camera?.z?.toFixed(1)}) player=(${state?.player?.x?.toFixed(1)},${state?.player?.y?.toFixed(1)},${state?.player?.z?.toFixed(1)})`);
  return { file, state };
}

// ---- 主流程 ----
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page");
assert.ok(target, "请先启动带 --remote-debugging-port=9222 的 Chrome");
socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
wire(socket);

await send("Page.enable");
await send("Runtime.enable");
const { windowId } = await send("Browser.getWindowForTarget", { targetId: target.id });
await send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setTouchEmulationEnabled", { enabled: false });
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

await mkdir(directory, { recursive: true });

// 1 首页初始视角（真实跟随相机，无 ?cam）
await openWorld();
await capture("01-home-initial");

// 2-7 固定验收机位
for (const [name, pose] of Object.entries(POSES)) {
  await openWorld(`&cam=${encodeURIComponent(pose)}`);
  await capture(name);
}

// 8 玩家实际通过 C 路径：导航面板点「传送」到 CS 屿 → 转身面向主岛
//    （yaw≈−0.927，沿 C 径方向）→ 前进走出屿缘落到径踏板上 → 拍玩家 + 前路
await openWorld();
await evaluate(`(() => {
  document.querySelector('button[aria-label="打开世界导航（快捷键 M）"]')?.click();
  return true;
})()`);
await sleep(500);
await evaluate(`(() => {
  const cards = [...document.querySelectorAll('.world-nav__card')];
  const cs = cards.find((card) => card.textContent.includes('CS 饰品'));
  const btn = cs?.querySelector('.world-nav__card-btn');
  btn?.click();
  return Boolean(btn);
})()`);
await sleep(1800);
await sleepFrames(50);
// 传送后 cameraYaw≈2.059 → 目标 −0.927：yaw -= dx*0.0042 → dx=+711
await drag(711, 0);
await sleepFrames(20);
await hold("KeyW", 1200);
await sleepFrames(70);
await capture("08-player-on-c");

const sceneErrors = errors.filter((error) => !/synchronously unmount a root/i.test(String(error)));
await writeFile(
  path.join(directory, "report.json"),
  JSON.stringify({ tag, viewport: { width: 1440, height: 900 }, errors: sceneErrors }, null, 2),
);
assert.deepEqual(sceneErrors, [], "console errors");
console.log("done:", tag, "console errors:", sceneErrors.length);
socket.close();
