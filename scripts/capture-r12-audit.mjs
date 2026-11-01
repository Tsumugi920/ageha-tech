/**
 * R12.0-A 整体视觉审计截图：19 个审计机位（真实首页初始 + 主岛六向 + 三屿 +
 * 岛缘/岩层 + 植被近景 + 远景浮岛 + 冰海天空 + C 径衔接 + 玩家探索）。
 *
 * 用法（需先启动 dev server 与带 --remote-debugging-port=9222 的 Chrome）：
 *   node scripts/capture-r12-audit.mjs --tag baseline
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(`--${key}`) ? args[args.indexOf(`--${key}`) + 1] : fallback;
const tag = option("tag", "baseline");
const url = option("url", "http://localhost:3457");
const directory = option("out", `.r12-shots/audit-${tag}`);
const port = Number(option("port", 9222));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 审计机位（?cam=pos.x,pos.y,pos.z,look.x,look.y,look.z） */
const POSES = {
  // 主岛四向 + 东北/东南
  "02-island-front": "0,4.5,42, 0,1.5,0",
  "03-island-side-west": "-48,7,10, 0,1,-2",
  "04-island-topdown": "0.01,62,8, 0,0,0",
  "05-island-north": "2,6,-42, 0,1.5,2",
  "06-island-east": "44,5,-2, 0,1,0",
  // 中央广场 + 蝶枢地标
  "07-plaza-core": "7,3.2,10, -3,2.5,-4",
  "08-butterfly-core": "6,8.5,9, 0,6.8,0",
  // 三屿地标
  "09-agehaos-isle": "-12,9,-46, -22,6,-58",
  "10-cs-isle": "-42,13,20, -64,10,34",
  "11-moss-isle": "32,5,18, 48,-2,30",
  // 岛缘与底部岩层
  "12-rim-underside": "-34,-5.5,16, -4,-4,-2",
  "13-rim-close": "-22,-1.5,10, -15,-1.5,5",
  // 植被近景（西岭松簇）
  "14-pines-close": "-10.5,2.6,2.5, -14.4,0.8,-0.2",
  // 远景浮岛（NW 群 + AgehaOS 景深线）
  "15-distant-nw": "0,9,4, -110,26,-105",
  // 冰海 + 天空 + 云层
  "16-ice-sea-sky": "-25,6,38, -80,2,70",
  // C 径与主岛衔接
  "17-trail-c-entry": "-8,2.6,7.5, -16,0.6,7.5",
  // 天空穹顶仰视
  "18-sky-zenith": "0,3,14, 0,30,-10",
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

// 2-18 固定审计机位
for (const [name, pose] of Object.entries(POSES)) {
  await openWorld(`&cam=${encodeURIComponent(pose)}`);
  await capture(name);
}

// 19 玩家探索：出生点朝主路前进穿过广场
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
