import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(`--${key}`) ? args[args.indexOf(`--${key}`) + 1] : fallback;
const tag = option("tag", "after");
const tier = option("tier", "high");
const url = option("url", "http://localhost:3000");
const directory = `screenshots/agehaos-r6/${tag}`;
const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const target = targets.find((item) => item.type === "page" && item.url.includes("localhost"));
assert.ok(target, "Open the local site in a CDP-enabled browser first");
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
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
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
const keys = { Digit1: ["1", 49], KeyW: ["w", 87], KeyE: ["e", 69], Escape: ["Escape", 27] };
const press = async (code, count = 3) => {
  const [key, keyCode] = keys[code];
  const params = { code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  await frames(count);
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
};
const captures = {};
async function capture(name) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const file = path.join(directory, `${name}.png`);
  await writeFile(file, Buffer.from(result.data, "base64"));
  captures[name] = await evaluate(`(() => ({
    state: window.__AGEHA_WORLD_STATE__(), render: window.__AGEHA_WORLD_INFO__(),
    detailOpen: Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open')),
    title: document.querySelector('[data-world-panel="detail"] .world-panel__title')?.textContent,
    prompt: document.querySelector('.world-hud__prompt-btn')?.textContent,
    links: [...document.querySelectorAll('[data-world-panel="detail"] a')].map(a => ({ text: a.textContent, href: a.href, target: a.target, rel: a.rel }))
  }))()`);
  captures[name].file = file;
  console.log(`${name}: ${file}`);
}

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
  await send("Page.navigate", { url: `${url}/?debug=1&tier=${tier}` });
  await send("Page.bringToFront");
  await evaluate(`new Promise((resolve, reject) => {
    const start = performance.now();
    const check = () => {
      if (document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && window.__AGEHA_WORLD_INFO__) resolve(true);
      else if (performance.now() - start > 75000) reject(new Error('World readiness timeout'));
      else requestAnimationFrame(check);
    }; check();
  })`);
  await frames();
  await evaluate(`document.querySelector('.world-toast__close')?.click()`);
  await mkdir(directory, { recursive: true });
  await capture("01-main");
  await press("Digit1");
  await frames(150);
  await capture("02-arrival");
  await press("KeyW", 28);
  await frames();
  await capture("03-near");
  await press("KeyE");
  await frames();
  await capture("04-detail");
  assert.equal(captures["04-detail"].detailOpen, true, "E opens project details");
  assert.equal(captures["04-detail"].title, "AgehaOS");
  assert.ok(captures["04-detail"].links.some((link) => link.href === "https://os.ageha.cn/" && link.target === "_blank" && /noopener|noreferrer/.test(link.rel)), "Live project link preserved");
  await press("Escape");
  await frames();
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open'))`), false);
  const prompt = await evaluate(`(() => { const b = document.querySelector('.world-hud__prompt-btn'); if (!b) return false; b.click(); return true; })()`);
  assert.equal(prompt, true, "Arrival prompt available");
  await frames(30);
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open'))`), true, "Prompt opens details");
  await press("Escape");
  await frames();
  const asset = await evaluate(`(() => {
    const canvas = document.querySelector('.world-canvas canvas');
    let fiber = canvas[Object.keys(canvas).find(k => k.startsWith('__reactFiber'))];
    let state;
    while (fiber) {
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const s = hook.memoizedState?.current;
        if (s?.gl && s?.scene && s?.camera) state = s.get();
      }
      fiber = fiber.return;
    }
    const tower = state?.scene.getObjectByName('agehaos-control-station');
    if (!tower) return null;
    let meshes = 0, triangles = 0;
    tower.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
    window.__towerCaptureState = state;
    const screen = tower.localToWorld(tower.position.clone().set(0, 2.67, 2.06)).project(state.camera);
    return { meshes, triangles, screen: { x: (screen.x + 1) * innerWidth / 2, y: (1 - screen.y) * innerHeight / 2 } };
  })()`);
  if (asset) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", ...asset.screen, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...asset.screen, button: "left", clickCount: 1 });
    await frames(30);
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open'))`), true, "Clicking the tower opens details");
    const previousTargets = new Set((await send("Target.getTargets")).targetInfos.map((t) => t.targetId));
    await evaluate(`document.querySelector('[data-world-panel="detail"] a[target="_blank"]').click()`);
    const targets = (await send("Target.getTargets")).targetInfos;
    const opened = targets.find((t) => !previousTargets.has(t.targetId) && t.type === "page" && t.url.startsWith("https://os.ageha.cn"));
    assert.ok(opened, "Online experience opens the real AgehaOS site in a new tab");
    await send("Target.closeTarget", { targetId: opened.targetId });
    await send("Page.bringToFront");
    await press("Escape");
    await frames();
    const savedCamera = await evaluate(`(() => { const s = window.__towerCaptureState; s.setFrameloop('never'); return { position: s.camera.position.toArray(), quaternion: s.camera.quaternion.toArray(), fov: s.camera.fov }; })()`);
    try {
      for (const view of [
        { name: "05-close-quarter", position: [-10.5, 10.8, -42.5] },
        { name: "06-rear-quarter", position: [-33.5, 11.5, -72.5] },
      ]) {
        await evaluate(`(() => {
          const s = window.__towerCaptureState;
          s.camera.position.fromArray(${JSON.stringify(view.position)}); s.camera.fov = 42;
          s.camera.lookAt(-22, 8.9, -58); s.camera.updateProjectionMatrix();
          s.scene.updateMatrixWorld(true); s.gl.render(s.scene, s.camera);
        })()`);
        await capture(view.name);
      }
    } finally {
      await evaluate(`(() => { const s = window.__towerCaptureState; s.camera.position.fromArray(${JSON.stringify(savedCamera.position)}); s.camera.quaternion.fromArray(${JSON.stringify(savedCamera.quaternion)}); s.camera.fov = ${savedCamera.fov}; s.camera.updateProjectionMatrix(); s.setFrameloop('always'); delete window.__towerCaptureState; })()`);
    }
  }
  const report = { tag, tier, viewport: { width: 1440, height: 900 }, reducedMotion: true, captures, asset, errors };
  await writeFile(path.join(directory, "verification.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ asset, errors, interactionPassed: true }, null, 2));
  assert.equal(errors.length, 0, "No browser runtime errors");
} finally {
  await send("Emulation.setEmulatedMedia", { features: [] }).catch(() => {});
  socket.close();
}
