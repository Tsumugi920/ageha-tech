/**
 * R12.1 地形与自然资产精修截图：十项验收机位（真实首页初始 + 主岛正/侧/底 +
 * 岩层近景 + 三型树木近景 + 岩石融合近景 + 玩家探索）。
 *
 * 近景机位全部经过 scripts/verify-r121-cams.mjs 的地形净空验证
 * （14 号旧机位被西岭坡体遮挡的教训：先算净空再拍）。
 *
 * 用法（需先启动 dev server 与带 --remote-debugging-port=9222 的 Chrome）：
 *   node scripts/capture-r121.mjs --tag baseline
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(`--${key}`) ? args[args.indexOf(`--${key}`) + 1] : fallback;
const tag = option("tag", "baseline");
const url = option("url", "http://localhost:3457");
const directory = option("out", `.r12-shots/r121-${tag}`);
const port = Number(option("port", 9222));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 验收机位（?cam=pos.x,pos.y,pos.z,look.x,look.y,look.z） */
const POSES = {
  // 主岛正面 / 侧面 / 底部（沿用 R12 审计机位，保证跨轮可比）
  "02-island-front": "0,4.5,42, 0,1.5,0",
  "03-island-side-west": "-48,7,10, 0,1,-2",
  "12-rim-underside": "-34,-5.5,16, -4,-4,-2",
  // 岩层近景：R12.1-E 修正（旧 13 号贴壁过近，画面被单一表面占据）
  "13-rim-close": "-30,0.8,16, -16,-2.5,5",
  // 三型树木近景（14 号旧机位陷在西岭坡内，整幅被雪坡遮挡）
  "14a-pine-spire": "-6.2,1.9,-4.6, -14.2,2.6,-0.9",
  "14b-pine-broad": "5.8,2.4,2.2, 13.4,1.7,-2.6",
  "14c-pine-tuft": "-9.6,1.7,10.8, -4.9,1.0,8.9",
  // 岩石与地表融合近景：冰碛带岩簇
  "15-rocks-fusion": "8.6,3.0,-2.4, 12.6,2.0,-6.8",
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
  // 引导卡关闭钮是 .world-toast__cancel，且卡片晚于 ready 出现——点击 +
  // CSS 双保险，避免偶发竞态把引导卡拍进画面（R12.1-D 实测踩坑）
  await evaluate(`document.querySelector('.world-toast__cancel')?.click()`);
  await evaluate(`document.querySelector('.world-hud__hint-close')?.click()`);
  await evaluate(`(() => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal{display:none!important}.world-toast{display:none!important}.world-hud__hint{display:none!important}';
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
  console.log(`${name}: ${file}  cam=(${state?.camera?.x?.toFixed(1)},${state?.camera?.y?.toFixed(1)},${state?.camera?.z?.toFixed(1)})`);
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

// 2-9 固定验收机位
for (const [name, pose] of Object.entries(POSES)) {
  await openWorld(`&cam=${encodeURIComponent(pose)}`);
  await capture(name);
}

// 10 玩家探索：出生点朝主路前进穿过广场
await openWorld();
await hold("KeyW", 2600);
await sleepFrames(80);
await capture("19-player-explore");

const sceneErrors = errors.filter((error) => !/synchronously unmount a root/i.test(String(error)));
await writeFile(
  path.join(directory, "report.json"),
  JSON.stringify({ tag, viewport: { width: 1440, height: 900 }, errors: sceneErrors }, null, 2),
);
assert.deepEqual(sceneErrors, [], "console errors");
console.log("done:", tag, "console errors:", sceneErrors.length);
socket.close();
