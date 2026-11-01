/**
 * 世界交互冒烟测试（R3）：通过 Chrome DevTools Protocol 驱动真实浏览器，
 * 按固定顺序走一遍「进入 → 前进 → 横移观察 → 靠近地标 → 打开详情 →
 * 返回起点 → 缩放 → 移动端触摸」，每步截图并采集玩家 / 相机 / 地面状态，
 * 最后输出 report.json。
 *
 * 用法（需先启动 dev server 与带 --remote-debugging-port=9222 的 Chrome）：
 *   node scripts/world-smoke.mjs --outDir screenshots/r3-final/desktop --width 1440 --height 900
 *   node scripts/world-smoke.mjs --outDir screenshots/r3-final/mobile --width 390 --height 844 --mobile
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const outDir = option("outDir", "screenshots/r3-final/run");
const width = Number(option("width", 1440));
const height = Number(option("height", 900));
const mobile = flag("mobile");
const url = option("url", "http://localhost:3000");
const port = Number(option("port", 9222));
const tag = option("tag", mobile ? "mobile" : "desktop");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target =
  targets.find((item) => item.type === "page" && item.url.includes("localhost")) ??
  targets.find((item) => item.type === "page");
if (!target) throw new Error("没有可用页面目标；请启动带 --remote-debugging-port 的 Chrome");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const runtimeErrors = [];
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
    runtimeErrors.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text ??
        "exception",
    );
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    runtimeErrors.push(
      message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "),
    );
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
    throw new Error(
      result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
    );
  }
  return result.result.value;
}

const keyMap = {
  KeyW: [87, "w"],
  KeyA: [65, "a"],
  KeyS: [83, "s"],
  KeyD: [68, "d"],
  KeyE: [69, "e"],
  KeyR: [82, "r"],
  KeyM: [77, "m"],
  KeyH: [72, "h"],
  Escape: [27, "Escape"],
  Digit1: [49, "1"],
  Digit2: [50, "2"],
  Digit3: [51, "3"],
};

async function keyDown(code) {
  const [virtualKey, keyValue] = keyMap[code] ?? [0, code];
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    code,
    key: keyValue,
    windowsVirtualKeyCode: virtualKey,
    nativeVirtualKeyCode: virtualKey,
  });
}
async function keyUp(code) {
  const [virtualKey, keyValue] = keyMap[code] ?? [0, code];
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code,
    key: keyValue,
    windowsVirtualKeyCode: virtualKey,
    nativeVirtualKeyCode: virtualKey,
  });
}
async function pressKey(code, holdMs) {
  await keyDown(code);
  await sleep(holdMs);
  await keyUp(code);
  await sleep(280);
}

async function dragPointer(fromX, fromY, toX, toY) {
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: fromX,
    y: fromY,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: fromX + ((toX - fromX) * i) / steps,
      y: fromY + ((toY - fromY) * i) / steps,
      button: "left",
      buttons: 1,
    });
    await sleep(16);
  }
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: toX,
    y: toY,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await sleep(200);
}

async function wheel(deltaY, times) {
  for (let i = 0; i < times; i += 1) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: width / 2,
      y: height / 2,
      deltaX: 0,
      deltaY,
    });
    await sleep(120);
  }
  await sleep(320);
}

async function state() {
  return evaluate(
    `window.__AGEHA_WORLD_STATE__ ? window.__AGEHA_WORLD_STATE__() : null`,
  ).catch(() => null);
}

const captures = {};
async function capture(name) {
  await mkdir(outDir, { recursive: true });
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const file = path.join(outDir, `${tag}-${name}.png`);
  await writeFile(file, Buffer.from(shot.data, "base64"));
  const worldState = await state();
  const ui = await evaluate(`(() => {
    const root = document.querySelector('#world-root');
    return {
      phase: root?.dataset.worldPhase ?? null,
      panelOpen: root?.dataset.panelOpen === 'true',
      detailOpen: Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open')),
      detailTitle: document.querySelector('[data-world-panel="detail"] .world-panel__title')?.textContent ?? null,
      zone: document.querySelector('.world-hud__zone')?.textContent ?? null,
      prompt: document.querySelector('.world-hud__prompt-btn')?.textContent ?? null,
      canvas: (() => {
        const canvas = document.querySelector('.world-canvas canvas');
        return canvas ? { width: canvas.width, height: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight } : null;
      })(),
      dpr: window.devicePixelRatio,
    };
  })()`).catch(() => null);
  captures[name] = { file, state: worldState, ui };
  console.log(`  · ${name}  zone=${ui?.zone ?? "?"}  player=(${worldState?.player?.x?.toFixed(1) ?? "?"}, ${worldState?.player?.y?.toFixed(1) ?? "?"}, ${worldState?.player?.z?.toFixed(1) ?? "?"})`);
}

async function fpsSample() {
  return evaluate(
    `new Promise((resolve) => { let frames = 0; const start = performance.now(); const tick = () => { frames += 1; if (performance.now() - start < 2500) requestAnimationFrame(tick); else resolve(Math.round((frames / ((performance.now() - start) / 1000)) * 10) / 10); }; requestAnimationFrame(tick); })`,
    true,
  ).catch(() => null);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable").catch(() => {});
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile,
  screenWidth: width,
  screenHeight: height,
});
await send("Emulation.setTouchEmulationEnabled", {
  enabled: mobile,
  maxTouchPoints: mobile ? 5 : 1,
}).catch(() => {});
await send("Page.navigate", { url: `${url.replace(/\/$/, "")}/?debug=1` });
await send("Page.bringToFront").catch(() => {});
// R4：强制页面活跃，避免遮挡 / 后台导致的 rAF 暂停被误测为低帧率
await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
await send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});
await send("Emulation.setIdleOverride", {
  isUserActive: true,
  isScreenUnlocked: true,
}).catch(() => {});

let phase = "loading";
for (let i = 0; i < 100; i += 1) {
  await sleep(250);
  phase = await evaluate(
    `document.querySelector('#world-root')?.dataset.worldPhase ?? 'loading'`,
  ).catch(() => "loading");
  if (phase === "ready") break;
}
if (phase !== "ready") {
  console.log(JSON.stringify({ ok: false, reason: "世界未就绪", phase }, null, 2));
  process.exit(1);
}
await sleep(1600);
runtimeErrors.length = 0;

// 1) 初始进入
await capture("01-entry");

if (!mobile) {
  // 2) 连续向前 5s
  await pressKey("KeyW", 5000);
  await capture("02-walk-north");

  // 3) 横向移动 + 改变观察方向
  await keyDown("KeyD");
  await sleep(1400);
  await keyUp("KeyD");
  await dragPointer(width * 0.5, height * 0.5, width * 0.5 + 260, height * 0.5 - 40);
  await capture("03-strafe-look");

  // 4) 靠近 AgehaOS 地标（1 键传送）
  await pressKey("Digit1", 60);
  await sleep(2600);
  await capture("04-agehaos");

  // 5) 打开项目详情并关闭
  await pressKey("KeyE", 60);
  await sleep(800);
  await capture("05-project-detail");
  await pressKey("Escape", 60);
  await sleep(500);

  // 6) 返回起点
  await pressKey("KeyR", 60);
  await sleep(1400);
  await capture("06-respawn");

  // 7) 放大 / 缩小
  await wheel(-120, 2);
  await capture("07-zoom-in");
  await wheel(120, 3);
  await capture("08-zoom-out");
} else {
  // 2) 摇杆前进（触摸）
  const jx = 24 + 48;
  const jy = height - 24 - 48;
  const beforeMove = await state();
  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: jx, y: jy - 30, id: 1 }],
  }).catch(() => {});
  await sleep(1600);
  await send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  }).catch(() => {});
  await sleep(600);
  const afterTouch = await state();
  const movedByTouch =
    beforeMove && afterTouch
      ? Math.hypot(afterTouch.player.x - beforeMove.player.x, afterTouch.player.z - beforeMove.player.z) > 0.6
      : false;
  if (!movedByTouch) {
    // 合成 PointerEvent 兜底（个别无头环境不合成 pointer）
    await evaluate(`(() => {
      const base = document.querySelector('.world-joystick');
      if (!base) return false;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      base.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: cx, clientY: cy - 34, bubbles: true }));
      setTimeout(() => base.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true })), 1500);
      return true;
    })()`).catch(() => {});
    await sleep(1900);
  }
  await capture("02-mobile-move");

  // 3) 项目屿快速入口 → 详情
  await evaluate(
    `document.querySelectorAll('.world-hud__quick-mini')[0]?.click(); true;`,
  ).catch(() => {});
  await sleep(400);
  await evaluate(
    `document.querySelector('.world-hud__quick-item')?.click(); true;`,
  ).catch(() => {});
  await sleep(900);
  await capture("03-mobile-detail");
  await evaluate(
    `document.querySelector('[data-world-panel="detail"] .world-panel__close')?.click(); true;`,
  ).catch(() => {});
  await sleep(500);
  await capture("04-mobile-closed");

  // 4) 通过世界导航返回起点
  await evaluate(`document.querySelectorAll('.world-hud__quick-mini')[1]?.click(); true;`).catch(() => {});
  await sleep(600);
  await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('[data-world-panel="nav"] .world-nav__card-btn')];
    const spawn = buttons.find((b) => b.textContent?.includes('返回主岛'));
    spawn?.click();
    return Boolean(spawn);
  })()`).catch(() => {});
  await sleep(1800);
  await capture("05-mobile-respawn");
}

// 性能采样（世界已运行 ≥20s，冷编译结束）
// R4：先丢弃一轮采样（截图读回可能制造一次长帧），再测稳态
await send("Page.bringToFront").catch(() => {});
await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
await send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});
await fpsSample();
const fps = await fpsSample();

// 结果校验
const spawn = { x: 6.5, y: 0.35, z: 7 };
const checks = [];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
for (const [name, item] of Object.entries(captures)) {
  const s = item.state;
  if (!s) {
    checks.push({ name, ok: false, reason: "缺少世界状态探针" });
    continue;
  }
  const player = s.player;
  const cam = s.camera;
  const horizontal = Math.hypot(cam.x - player.x, cam.z - player.z);
  const cameraOk =
    horizontal > 4 && horizontal < 42 && cam.y > s.ground - 0.2 &&
    Math.hypot(cam.x - player.x, cam.y - player.y, cam.z - player.z) < 60;
  checks.push({
    name,
    cameraOk,
    cameraDistance: Math.round(Math.hypot(cam.x - player.x, cam.y - player.y, cam.z - player.z) * 100) / 100,
    cameraAboveGround: Math.round((cam.y - (s.ground ?? 0)) * 100) / 100,
    zone: item.ui?.zone ?? null,
  });
}
const respawn = captures["06-respawn"] ?? captures["05-mobile-respawn"];
const respawnOk = respawn?.state
  ? dist(respawn.state.player, spawn) < 1.6
  : null;
const detailShot = captures["05-project-detail"] ?? captures["03-mobile-detail"];
const detailOpenOk = detailShot?.ui?.detailOpen === true;
const report = {
  tag,
  viewport: { width, height, mobile, dpr: captures["01-entry"]?.ui?.dpr ?? null },
  fps,
  runtimeErrors,
  respawnOk,
  detailOpenOk,
  checks,
  captures: Object.fromEntries(
    Object.entries(captures).map(([name, item]) => [
      name,
      { file: item.file, zone: item.ui?.zone ?? null, state: item.state },
    ]),
  ),
};
await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ tag, fps, respawnOk, detailOpenOk, runtimeErrors, cameraIssues: checks.filter((c) => !c.cameraOk) }, null, 2));
socket.close();