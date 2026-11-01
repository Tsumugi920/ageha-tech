/**
 * P4 北径信标目标真实验收（补充 browser 场景）：
 * 走北径 → E 触发信标 → 目标 1/5、记忆环 1 瓣、本地记录 → 刷新保留 →
 * 复访再次触发不重复计数 / 不重复弹奖励。
 *
 * 用法：node scripts/verify-p4-relay.mjs（dev server + CDP 9222）
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = "http://127.0.0.1:3002";
const port = 9222;
const outDir = "screenshots/p4-final";
const STORAGE_KEY = "ageha.world.exploration";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page");
assert.ok(target, "需要 CDP 页面目标");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    errors.push(message.params.exceptionDetails?.exception?.description ?? "exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
async function waitFor(expression, timeout = 8000, label = expression) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return true;
    await sleep(120);
  }
  throw new Error(`等待超时：${label}`);
}
async function press(code, key, vk, wait = 150) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(40);
  await send("Input.dispatchKeyEvent", { type: "keyUp", code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(wait);
}
async function holdW(ms) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", code: "KeyW", key: "w", windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87 });
  await sleep(ms);
  await send("Input.dispatchKeyEvent", { type: "keyUp", code: "KeyW", key: "w", windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87 });
  await sleep(350);
}
async function snapshot() {
  return evaluate(`(() => {
    let raw = null;
    try { raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)}); } catch { raw = "THREW"; }
    return {
      summary: document.querySelector('.world-progress__summary')?.textContent?.trim() ?? null,
      done: [...document.querySelectorAll('[data-world-panel="nav"] .world-progress__item[data-done="true"]')].map((el) => el.querySelector('.world-progress__title')?.textContent?.trim()),
      notice: document.querySelector('.world-hud__progress')?.textContent?.trim() ?? null,
      memory: window.__AGEHA_MEMORY_RING__?.() ?? null,
      relay: window.__AGEHA_NORTH_STATE__?.() ?? null,
      world: window.__AGEHA_WORLD_STATE__?.() ?? null,
      prompt: document.querySelector('.world-hud__prompt-btn')?.textContent?.trim() ?? null,
      raw,
    };
  })()`);
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await mkdir(outDir, { recursive: true });

  await send("Page.navigate", { url: `${base}/projects` });
  await waitFor(`document.readyState === 'complete'`, 30000, "起始页");
  await evaluate(`localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);

  async function loadWorld() {
    await send("Page.navigate", { url: `${base}/?debug=1&tier=high` });
    await waitFor(
      `document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && Boolean(window.__AGEHA_WORLD_STATE__)`,
      90000,
      "世界就绪",
    );
    await sleep(900);
    await evaluate(`document.querySelector('.world-toast__close')?.click()`);
    await evaluate(`(() => {
      if (document.getElementById('p4-relay-hide-dev')) return;
      const style = document.createElement('style');
      style.id = 'p4-relay-hide-dev';
      style.textContent = 'nextjs-portal{display:none!important}';
      document.head.appendChild(style);
    })()`);
    await press("ShiftLeft", "Shift", 16, 60);
  }

  await loadWorld();
  await holdW(2650);
  let state = await snapshot();
  assert.ok(state.world, "应能读取玩家坐标");
  const relayDistance = Math.hypot(state.world.player.x + 2.6, state.world.player.z + 11.6);
  assert.ok(relayDistance < 6, `应走到信标交互范围（实际 ${relayDistance.toFixed(2)}）`);
  assert.equal(state.prompt?.includes("点亮北径"), true, `近信标应出现提示（实际 ${state.prompt}）`);

  await press("KeyE", "e", 69, 500);
  await waitFor(
    `document.querySelectorAll('[data-world-panel="nav"] .world-progress__item[data-done="true"]').length === 1`,
    6000,
    "信标目标完成",
  );
  state = await snapshot();
  assert.equal(state.summary, "1 / 5 瓣记忆已点亮");
  assert.deepEqual(state.done, ["点亮北径信标"]);
  assert.ok(state.notice?.includes("点亮北径信标"), "完成信标应有一次奖励提示");
  assert.equal(state.memory?.lit, 1);
  assert.ok(state.relay?.triggers >= 1, "信标真实触发计数应增加");
  assert.notEqual(state.relay?.phase, "idle", "信标应进入点亮阶段");
  const stored = JSON.parse(state.raw);
  assert.equal(stored.version, 1);
  assert.deepEqual(stored.completed, ["north-relay"]);

  const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(path.join(outDir, "16-relay-goal.png"), Buffer.from(screenshot.data, "base64"));

  // 刷新：进度保留、无重复奖励提示
  await loadWorld();
  state = await snapshot();
  assert.equal(state.summary, "1 / 5 瓣记忆已点亮", "刷新后信标目标应保留");
  assert.equal(state.notice, null, "刷新后不应重复弹奖励");
  assert.equal(state.memory?.lit, 1);

  // 复访再次点亮：计数不变、不重复提示
  await holdW(2650);
  await press("KeyE", "e", 69, 700);
  state = await snapshot();
  assert.equal(state.summary, "1 / 5 瓣记忆已点亮", "复访已完成信标不应增加计数");
  assert.equal(state.done.length, 1);
  assert.equal(state.notice, null, "复访已完成信标不应重复弹奖励");

  await evaluate(`localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  const sceneErrors = errors.filter((error) => !/synchronously unmount a root/i.test(String(error)));
  assert.deepEqual(sceneErrors, [], "信标验收不应有控制台异常");
  await writeFile(
    path.join(outDir, "report-relay.json"),
    JSON.stringify({ relayDistance, state, errors: sceneErrors }, null, 2),
  );
  console.log("P4 relay verification passed", { relayDistance, summary: state.summary, memory: state.memory });
} finally {
  socket.close();
}
