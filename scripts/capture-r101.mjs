/**
 * R10.1 材质补强验收：机位/输入与 R10 完全一致，新增地表 / 道路边缘近景 crop：沿用 R8 的固定输入序列与机位，新增广场近景机位，
 * 用于修改前 / 修改后同视口对照。
 *
 * 用法（需先启动 dev server 与带 --remote-debugging-port=9222 的 Chrome）：
 *   node scripts/capture-r9.mjs --tag before
 *   node scripts/capture-r9.mjs --tag after
 *
 * 机位：
 * - 01-entry / 02-rim-low / 03-plaza-top / 05-north-road / 06-side /
 *   07-agehaos-arrival / 08-agehaos-near 沿用 R8 capture-r9 的固定输入；
 * - 04-plaza-close：广场近景（继续前进 600ms，与 03 同视口）；
 * - 09-return：按 R 回航后与 01-entry 同视口对照。
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(`--${key}`) ? args[args.indexOf(`--${key}`) + 1] : fallback;
const tag = option("tag", "before");
const url = option("url", "http://localhost:3000");
const directory = `screenshots/r10.1/${tag}`;
const port = Number(option("port", 9222));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url.includes("localhost")) ?? targets.find((item) => item.type === "page");
assert.ok(target, "请先启动带 --remote-debugging-port=9222 的 Chrome");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });

let id = 0;
const pending = new Map();
const errors = [];
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
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${method} timed out`)); }, 90000);
  pending.set(requestId, { resolve, reject, timer });
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const frames = (count = 90) => evaluate(`new Promise(resolve => { let n = 0; const tick = () => ++n >= ${count} ? resolve(true) : requestAnimationFrame(tick); tick(); })`);

const keyMap = { KeyW: ["w", 87], Digit1: ["1", 49], Digit2: ["2", 50], Digit3: ["3", 51], KeyR: ["r", 82], Escape: ["Escape", 27] };
async function press(code, holdFrames = 3) {
  const [key, keyCode] = keyMap[code];
  const params = { code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  await frames(holdFrames);
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
  await frames(2);
}
async function hold(code, ms) {
  const [key, keyCode] = keyMap[code];
  const params = { code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  await sleep(ms);
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
  await sleep(400);
}
/** 画布拖拽（轨道观察）：dx>0 向左转，dy>0 抬高俯视 */
async function drag(dx, dy, steps = 10) {
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
    await frames(1);
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x0 + dx, y: y0 + dy, button: "left", buttons: 0, clickCount: 1 });
  await frames(6);
}
async function wheel(deltaY) {
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 450, deltaX: 0, deltaY, button: "none", buttons: 0 });
  await frames(8);
}

const captures = {};
async function capture(name, clip) {
  const result = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    ...(clip ? { clip: { ...clip, scale: clip.scale ?? 1 } } : {}),
  });
  const file = path.join(directory, `${name}.png`);
  await writeFile(file, Buffer.from(result.data, "base64"));
  const state = await evaluate(`window.__AGEHA_WORLD_STATE__ ? window.__AGEHA_WORLD_STATE__() : null`).catch(() => null);
  const render = await evaluate(`window.__AGEHA_WORLD_INFO__ ? window.__AGEHA_WORLD_INFO__() : null`).catch(() => null);
  captures[name] = { file, state, render };
  console.log(`${name}: ${file}`);
}

const near = (a, b, eps = 0.08) => Math.abs(a - b) <= eps;

try {
  await send("Page.enable");
  await send("Runtime.enable");
  const { windowId } = await send("Browser.getWindowForTarget", { targetId: target.id });
  await send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
  await send("Page.setWebLifecycleState", { state: "active" });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.navigate", { url: `${url}/?debug=1&tier=high` });
  await send("Page.bringToFront");
  await evaluate(`new Promise((resolve, reject) => {
    const start = performance.now();
    const check = () => {
      if (document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && window.__AGEHA_WORLD_INFO__) resolve(true);
      else if (performance.now() - start > 75000) reject(new Error('World readiness timeout'));
      else requestAnimationFrame(check);
    }; check();
  })`);
  await frames(90);
  await evaluate(`document.querySelector('.world-toast__close')?.click()`);
  await evaluate(`document.querySelector('.world-hud__hint-close')?.click()`);
  await evaluate(`(() => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal{display:none!important}';
    document.head.appendChild(style);
    return true;
  })()`);
  await frames(20);
  await mkdir(directory, { recursive: true });

  await capture("01-entry");

  await drag(0, -60);
  await drag(40, 0);
  await frames(60);
  await capture("02-rim-low");

  await press("KeyR");
  await frames(60);
  await drag(0, 55);
  await wheel(-1);
  await frames(40);
  await hold("KeyW", 700);
  await frames(30);
  await capture("03-plaza-top");

  await hold("KeyW", 600);
  await frames(40);
  await capture("04-plaza-close");
  await capture("10-surface-crop", { x: 330, y: 380, width: 560, height: 380, scale: 2 });

  await hold("KeyW", 1500);
  await frames(30);
  await capture("05-north-road");
  await capture("11-road-edge-crop", { x: 760, y: 470, width: 560, height: 380, scale: 2 });

  await press("KeyR");
  await frames(50);
  await press("Digit2");
  await sleep(900);
  await frames(80);
  await drag(350, 0);
  await drag(350, 0);
  await drag(40, 0);
  await drag(0, 35);
  await frames(90);
  await capture("06-side");
  await capture("06-side-crop", { x: 430, y: 140, width: 620, height: 400, scale: 2 });

  await press("Escape");
  await press("Digit1");
  await sleep(900);
  await frames(80);
  await capture("07-agehaos-arrival");
  await hold("KeyW", 1100);
  await press("Escape");
  await frames(40);
  await capture("08-agehaos-near");

  const entryCamera = captures["01-entry"]?.state?.camera;
  await press("KeyR");
  await send("Page.setWebLifecycleState", { state: "active" });
  await send("Page.bringToFront");
  await frames(30);
  const settle = await evaluate(`new Promise((resolve) => {
    const target = ${JSON.stringify(entryCamera)};
    const start = performance.now();
    let last = Infinity;
    const tick = () => {
      const snapshot = window.__AGEHA_WORLD_STATE__?.();
      if (snapshot) {
        last = Math.hypot(
          snapshot.camera.x - target.x,
          snapshot.camera.y - target.y,
          snapshot.camera.z - target.z,
        );
        if (last < 0.03) return resolve({ settled: true, delta: last });
      }
      if (performance.now() - start > 12000) return resolve({ settled: false, delta: last });
      requestAnimationFrame(tick);
    };
    tick();
  })`);
  assert.ok(settle.settled, `返回起点后相机应在阻尼时间内回到初始机位（当前偏差 ${settle.delta}）`);
  await frames(20);
  await capture("09-return");

  const info = await evaluate(`(() => ({
    zone: document.querySelector('.world-hud__zone')?.textContent ?? null,
    detailOpen: Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open')),
    canvas: (() => { const c = document.querySelector('.world-canvas canvas'); return c ? { w: c.width, h: c.height } : null; })(),
    hasConsoleBadge: Boolean(document.querySelector('nextjs-portal')),
  }))()`);

  const entry = captures["01-entry"]?.state;
  const returned = captures["09-return"]?.state;
  const checks = {
    returnPlayer: Boolean(entry && returned && near(entry.player.x, returned.player.x) && near(entry.player.y, returned.player.y) && near(entry.player.z, returned.player.z)),
    returnCamera: Boolean(entry && returned && near(entry.camera.x, returned.camera.x) && near(entry.camera.y, returned.camera.y) && near(entry.camera.z, returned.camera.z)),
    returnCameraState: Boolean(entry && returned && near(entry.cameraState.yaw, returned.cameraState.yaw) && near(entry.cameraState.pitch, returned.cameraState.pitch) && entry.cameraState.distanceIndex === returned.cameraState.distanceIndex),
    returnSettle: settle,
    zone: info.zone,
    detailOpen: info.detailOpen,
  };

  await writeFile(
    path.join(directory, "report.json"),
    JSON.stringify({ tag, viewport: { width: 1440, height: 900 }, errors, info, checks, captures }, null, 2),
  );
  assert.ok(checks.returnPlayer, "返回起点后玩家应回到出生点");
  assert.ok(checks.returnCamera, "返回起点后相机应回到初始机位");
  assert.ok(checks.returnCameraState, "返回起点后相机档位/角度应复位");
  const sceneErrors = errors.filter(
    (error) => !/synchronously unmount a root/i.test(String(error)),
  );
  assert.deepEqual(sceneErrors, [], "console errors");
  console.log("checks:", checks);
  console.log("errors:", errors);
  console.log("info:", info);
} finally {
  socket.close();
}
