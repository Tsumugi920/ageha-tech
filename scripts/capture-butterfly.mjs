import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(`--${key}`) ? args[args.indexOf(`--${key}`) + 1] : fallback;
const tag = option("tag", "after");
const port = option("port", "9222");
const url = option("url", "http://localhost:3000");
const tier = option("tier", "high");
const directory = `screenshots/butterfly-r5/${tag}`;
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url.includes("localhost"));
if (!target) throw new Error("Open the local site in a CDP-enabled browser first");
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
  pending.set(requestId, { resolve, reject });
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Page load timeout")), 60000);
    const listener = ({ data }) => {
      if (JSON.parse(data).method !== "Page.loadEventFired") return;
      clearTimeout(timeout);
      socket.removeEventListener("message", listener);
      resolve();
    };
    socket.addEventListener("message", listener);
  });
  await send("Page.navigate", { url: `${url}/?debug=1&tier=${tier}` });
  await loaded;
  await send("Page.bringToFront");
  await send("Page.setWebLifecycleState", { state: "active" });
  await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      if (document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && window.__AGEHA_WORLD_INFO__) resolve(true);
      else if (performance.now() - started > 60000) reject(new Error('World readiness timeout'));
      else requestAnimationFrame(check);
    }; check();
  })`);
  await evaluate(`new Promise(resolve => { let frames = 0; const tick = () => ++frames >= 90 ? resolve(true) : requestAnimationFrame(tick); tick(); })`);
  const initial = await evaluate(`(() => {
    document.querySelector('.world-toast__close')?.click();
    const canvas = document.querySelector('.world-canvas canvas');
    let fiber = canvas[Object.keys(canvas).find(key => key.startsWith('__reactFiber'))];
    while (fiber) {
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.gl && state?.scene && state?.camera) window.__captureState = state.get();
      }
      fiber = fiber.return;
    }
    const state = window.__captureState;
    if (!state) throw new Error('R3F Canvas root state not found');
    window.__captureCamera = { position: state.camera.position.clone(), quaternion: state.camera.quaternion.clone(), fov: state.camera.fov };
    state.setFrameloop('never');
    return { state: window.__AGEHA_WORLD_STATE__(), render: window.__AGEHA_WORLD_INFO__() };
  })()`);
  await mkdir(directory, { recursive: true });
  const startupErrors = errors.splice(0);
  const shots = [];
  for (const view of [
    { name: "main", angle: null },
    { name: "front", angle: 0.32 },
    { name: "quarter", angle: 0.32 + Math.PI / 4 },
  ]) {
    const camera = await evaluate(`(() => {
      const s = window.__captureState;
      ${view.angle === null
        ? `s.camera.position.set(15.08605602326299, 6.204053882080066, 21.00421660569696); s.camera.quaternion.set(-0.11521407538099539, 0.26959409726849554, 0.032507485884460736, 0.9555040569843535); s.camera.fov = 58;`
        : `s.camera.position.set(Math.sin(${view.angle}) * 12.5, 7.25, Math.cos(${view.angle}) * 12.5); s.camera.fov = 44; s.camera.lookAt(0, 7.25, 0);`}
      s.camera.updateProjectionMatrix();
      s.scene.updateMatrixWorld(true);
      s.gl.render(s.scene, s.camera);
      return { position: s.camera.position.toArray(), quaternion: s.camera.quaternion.toArray(), fov: s.camera.fov };
    })()`);
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    const file = path.join(directory, `${view.name}.png`);
    await writeFile(file, Buffer.from(shot.data, "base64"));
    shots.push({ view: view.name, file, camera });
  }
  const report = { tag, tier, viewport: { width: 1440, height: 900, dpr: 1 }, reducedMotion: true, initial, shots, startupErrors, errors };
  await writeFile(path.join(directory, "capture.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await evaluate(`(() => {
    const s = window.__captureState, camera = window.__captureCamera;
    if (s && camera) {
      s.camera.position.copy(camera.position); s.camera.quaternion.copy(camera.quaternion); s.camera.fov = camera.fov;
      s.camera.updateProjectionMatrix(); s.setFrameloop('always');
    }
    delete window.__captureState; delete window.__captureCamera;
  })()`).catch(() => {});
  await send("Emulation.setEmulatedMedia", { features: [] });
  socket.close();
}
