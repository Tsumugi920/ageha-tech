/**
 * R4 真实验收：连接已启动的 Chrome（--remote-debugging-port），
 * 强制页面可见后，按状态采集多轮 rAF 帧时间 + 截图 + DOM 布局检查。
 *
 * 关键修复（R3 的 5.3 FPS 假象）：Chrome 遮挡/后台时 document.hidden=true，
 * requestAnimationFrame 会被完全暂停，旧脚本把挂起时长算进帧率。本脚本在
 * 导航后立即 setWebLifecycleState('active') + focus emulation，并在每次
 * 采样前后校验 visibilityState；不可见时直接判定本次采样无效。
 *
 * 用法（需先 npm run build && npm run start + 带调试端口的 Chrome）：
 *   node scripts/verify-r4.mjs --tag desktop-1440 --width 1440 --height 900 --dsf 1
 *   node scripts/verify-r4.mjs --tag desktop-2560 --width 2560 --height 1440 --dsf 1
 *   node scripts/verify-r4.mjs --tag mobile-390 --width 390 --height 844 --dsf 3 --mobile
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

const tag = option("tag", "run");
const width = Number(option("width", 1440));
const height = Number(option("height", 900));
const dsf = Number(option("dsf", 1));
const mobile = flag("mobile");
const outDir = option("outDir", `screenshots/r4/${tag}`);
const baseUrl = option("url", "http://localhost:3000");
const port = Number(option("port", 9222));
const warmupMs = Number(option("warmup", 5000));
const sampleMs = Number(option("sample", 3000));
const rounds = Math.max(1, Number(option("rounds", 3)));
const downscale = flag("downscale");
const cpuThrottle = Number(option("cpuThrottle", 1));
const tierOverride = option("tier", null);
const sustainMs = Number(option("sustain", 0));

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
  Digit1: [49, "1"],
  Digit2: [50, "2"],
  Digit3: [51, "3"],
  Escape: [27, "Escape"],
};

async function press(code, holdMs = 60) {
  const [virtualKey, keyValue] = keyMap[code] ?? [0, code];
  const base = {
    code,
    key: keyValue,
    windowsVirtualKeyCode: virtualKey,
    nativeVirtualKeyCode: virtualKey,
  };
  await send("Input.dispatchKeyEvent", { type: "keyDown", ...base });
  await sleep(holdMs);
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}

async function forceVisible() {
  await send("Page.bringToFront").catch(() => {});
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
  await send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});
  await send("Emulation.setIdleOverride", {
    isUserActive: true,
    isScreenUnlocked: true,
  }).catch(() => {});
}

/**
 * rAF 采样：同时记录每帧间隔（ms）。采样结束用「总时长 / 帧数」算平均 FPS，
 * 而不是取 60 的整数倍；p95 帧时间用来识别尾帧卡顿。
 */
async function fpsSample(durationMs) {
  return evaluate(
    `new Promise((resolve) => {
      const make = () => {
        const frames = [];
        let last = performance.now();
        const start = last;
        const finish = () => {
          const elapsed = performance.now() - start;
          const sorted = [...frames].sort((a, b) => a - b);
          const avg = frames.reduce((sum, value) => sum + value, 0) / Math.max(1, frames.length);
          const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
          const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
          resolve({
            frames: frames.length,
            durationMs: Math.round(elapsed),
            avgFps: Math.round((frames.length / (elapsed / 1000)) * 10) / 10,
            avgFrameMs: Math.round(avg * 100) / 100,
            medianFrameMs: Math.round(median * 100) / 100,
            p95FrameMs: Math.round(p95 * 100) / 100,
            maxFrameMs: Math.round((sorted[sorted.length - 1] ?? 0) * 100) / 100,
            longFrames: frames.filter((ms) => ms > 33.4).length,
            visibility: document.visibilityState,
            hidden: document.hidden,
          });
        };
        const tick = (now) => {
          frames.push(now - last);
          last = now;
          if (now - start < ${durationMs}) requestAnimationFrame(tick);
          else finish();
        };
        requestAnimationFrame(tick);
        setTimeout(finish, ${durationMs + 2500});
      };
      requestAnimationFrame(() => requestAnimationFrame(make));
    })`,
    true,
  );
}

async function sample(label) {
  await forceVisible();
  // 丢弃一轮预热采样：首次进入时的着色器 / 纹理上传不计入稳态。
  await fpsSample(1000);
  await sleep(350);
  const results = [];
  const discarded = [];
  for (let i = 0; i < rounds; i += 1) {
    let result = await fpsSample(sampleMs);
    // screenshot / GC 可能制造单次 >0.8s 的暂停；重测，但保留原始记录。
    let retry = 0;
    while (
      result &&
      !result.hidden &&
      result.frames > 0 &&
      result.maxFrameMs > 800 &&
      retry < 2
    ) {
      discarded.push(result);
      retry += 1;
      await forceVisible();
      await sleep(500);
      result = await fpsSample(sampleMs);
    }
    results.push(result);
    console.log(
      `  · ${label} [${i + 1}/${rounds}] ${result.avgFps} fps · ${result.avgFrameMs}ms · p95 ${result.p95FrameMs}ms · max ${result.maxFrameMs}ms · ${result.visibility}`,
    );
  }
  const valid = results.filter((item) => item && !item.hidden);
  const avgFps =
    valid.length > 0
      ? Math.round((valid.reduce((sum, item) => sum + item.avgFps, 0) / valid.length) * 10) / 10
      : null;
  return {
    label,
    rounds: results,
    discardedRounds: discarded,
    validRounds: valid.length,
    avgFps,
    avgFrameMs:
      valid.length > 0
        ? Math.round(
            (valid.reduce((sum, item) => sum + item.avgFrameMs, 0) / valid.length) * 100,
          ) / 100
        : null,
    p95FrameMs:
      valid.length > 0
        ? Math.round(
            (valid.reduce((sum, item) => sum + item.p95FrameMs, 0) / valid.length) * 100,
          ) / 100
        : null,
  };
}

async function info() {
  return evaluate(`(() => {
    const root = document.querySelector('#world-root');
    const canvas = document.querySelector('.world-canvas canvas');
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    return {
      phase: root?.dataset.worldPhase ?? null,
      panelOpen: root?.dataset.panelOpen ?? null,
      dpr: window.devicePixelRatio,
      inner: { width: innerWidth, height: innerHeight },
      canvas: canvas ? { width: canvas.width, height: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight } : null,
      intro: rect('.world-toast'),
      joystick: rect('.world-joystick'),
      quick: rect('.world-hud__quick'),
      zone: rect('.world-hud__zone'),
      panel: rect('[data-world-panel="detail"]'),
      panelHeader: rect('[data-world-panel="detail"] .world-panel__header'),
      panelClose: rect('[data-world-panel="detail"] .world-panel__close'),
      panelBody: (() => {
        const body = document.querySelector('[data-world-panel="detail"] .world-panel__body');
        return body ? { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, scrollTop: body.scrollTop } : null;
      })(),
      state: window.__AGEHA_WORLD_STATE__?.() ?? null,
      render: window.__AGEHA_WORLD_INFO__?.() ?? null,
    };
  })()`).catch(() => null);
}

async function screenshot(name, scaleToCss = false) {
  await mkdir(outDir, { recursive: true });
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const file = path.join(outDir, `${tag}-${name}.png`);
  let buffer = Buffer.from(shot.data, "base64");
  if (scaleToCss && dsf !== 1) {
    const { default: sharp } = await import("sharp");
    buffer = await sharp(buffer)
      .resize(Math.round(width), Math.round(height), { fit: "fill" })
      .png()
      .toBuffer();
  }
  await writeFile(file, buffer);
  return file;
}

async function click(selector) {
  await evaluate(
    `document.querySelector(${JSON.stringify(selector)})?.click(); true;`,
  ).catch(() => {});
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
await send("Emulation.setTouchEmulationEnabled", {
  enabled: mobile,
  maxTouchPoints: mobile ? 5 : 1,
}).catch(() => {});
if (cpuThrottle > 1) {
  await send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle }).catch(() => {});
}
const navUrl = `${baseUrl}/?debug=1${tierOverride ? `&tier=${encodeURIComponent(tierOverride)}` : ""}`;
await send("Page.navigate", { url: navUrl });
await forceVisible();

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

await forceVisible();
await sleep(warmupMs);
runtimeErrors.length = 0;

const captures = {};
const checks = {};
const gpu = await evaluate(`(() => {
  const canvas = document.querySelector('.world-canvas canvas');
  const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
    vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
    ua: navigator.userAgent,
    platform: navigator.platform,
    cores: navigator.hardwareConcurrency,
    memory: navigator.deviceMemory ?? null,
  };
})()`).catch(() => null);

// 1) 初始（引导卡仍在；先测 UI 重叠，再关闭）
const introInfo = await info();
checks.intro = introInfo
  ? {
      intro: introInfo.intro,
      joystick: introInfo.joystick,
      quick: introInfo.quick,
      overlapJoystick: overlap(introInfo.intro, introInfo.joystick),
      overlapQuick: overlap(introInfo.intro, introInfo.quick),
    }
  : null;
captures["01-entry-intro"] = await screenshot("01-entry-intro", downscale);
await click(".world-toast__close");
await sleep(500);

const entry = await sample("initial");
captures["02-entry-scene"] = await screenshot("02-entry-scene", downscale);
const entryInfo = await info();
checks.entry = {
  canvas: entryInfo?.canvas,
  dpr: entryInfo?.dpr,
  introVisible: Boolean(entryInfo?.intro),
  render: entryInfo?.render,
  state: entryInfo?.state,
};

// 2) 连续移动
const moving = await (async () => {
  await forceVisible();
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    code: "KeyW",
    key: "w",
    windowsVirtualKeyCode: 87,
    nativeVirtualKeyCode: 87,
  });
  const result = await sample("moving");
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code: "KeyW",
    key: "w",
    windowsVirtualKeyCode: 87,
    nativeVirtualKeyCode: 87,
  });
  await sleep(500);
  return result;
})();
captures["03-move"] = await screenshot("03-move", downscale);

// 3) 项目详情打开（世界仍在其后渲染）
await click(".world-hud__quick-mini");
await sleep(350);
await click(".world-hud__quick-item");
await sleep(900);
const detailInfo = await info();
checks.detail = detailInfo
  ? {
      panel: detailInfo.panel,
      header: detailInfo.panelHeader,
      close: detailInfo.panelClose,
      body: detailInfo.panelBody,
      headerInViewport:
        Boolean(detailInfo.panelHeader) &&
        detailInfo.panelHeader.y >= 0 &&
        detailInfo.panelHeader.bottom <= height,
      closeInViewport:
        Boolean(detailInfo.panelClose) &&
        detailInfo.panelClose.y >= 0 &&
        detailInfo.panelClose.bottom <= height,
    }
  : null;
const detail = await sample("detail-open");
captures["04-detail"] = await screenshot("04-detail", downscale);

// 4) 详情关闭后的恢复
await click('[data-world-panel="detail"] .world-panel__close');
await sleep(700);
const closedInfo = await info();
checks.closed = {
  panelOpen: closedInfo?.panelOpen,
  joystick: closedInfo?.joystick,
  quick: closedInfo?.quick,
};
const closed = await sample("detail-closed");
captures["05-detail-closed"] = await screenshot("05-detail-closed", downscale);

// 5) 回起点
await press("KeyR");
await sleep(900);
const respawnInfo = await info();
checks.respawn = {
  state: respawnInfo?.state,
  canvas: respawnInfo?.canvas,
};
captures["06-respawn"] = await screenshot("06-respawn", downscale);

let sustain = null;
if (sustainMs > 0) {
  await forceVisible();
  sustain = await fpsSample(sustainMs);
  console.log(
    `  · sustained ${sustainMs / 1000}s  ${sustain.avgFps} fps · ${sustain.avgFrameMs}ms · p95 ${sustain.p95FrameMs}ms`,
  );
}

const report = {
  ok: true,
  tag,
  environment: {
    viewport: { width, height, dsf, mobile },
    emulatedMobile: mobile,
    cpuThrottle,
    tierOverride,
    gpu,
    note: mobile
      ? `Chrome 移动视口/触控模拟（非真实手机）；CPU 节流 ${cpuThrottle}×；GPU 为桌面 RTX 4050`
      : `Chrome 桌面窗口；CPU 节流 ${cpuThrottle}×；真实 GPU`,
  },
  warmupMs,
  sampleMs,
  rounds,
  performance: { entry, moving, detail, closed },
  sustain,
  checks,
  captures,
  runtimeErrors,
};
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      tag,
      fps: {
        entry: entry.avgFps,
        moving: moving.avgFps,
        detail: detail.avgFps,
        closed: closed.avgFps,
        sustained: sustain?.avgFps ?? null,
      },
      overlaps: { joystick: checks.intro?.overlapJoystick, quick: checks.intro?.overlapQuick },
      detail: checks.detail,
      errors: runtimeErrors,
    },
    null,
    2,
  ),
);
await send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
socket.close();

function overlap(a, b) {
  if (!a || !b) return null;
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}
