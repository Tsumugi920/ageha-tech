/**
 * R12.0-A 探针：在 03 侧西机位遍历场景，找出西侧海面上深色漂浮多面体的归属组件。
 * 用法：node scripts/probe-r12-shards.mjs
 */
import assert from "node:assert/strict";

const url = "http://localhost:3457";
const port = 9222;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let socket;
let id = 0;
const pending = new Map();
function wire(socket) {
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  };
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${method} timed out`)); }, 60000);
  pending.set(requestId, { resolve, reject, timer });
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page");
assert.ok(target, "no page target");
socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
wire(socket);
await send("Page.enable");
await send("Runtime.enable");

await send("Page.navigate", { url: `${url}/?debug=1&tier=high&cam=${encodeURIComponent("-48,7,10, 0,1,-2")}` });
await send("Page.bringToFront");
console.error("navigated");
for (let i = 0; i < 90; i += 1) {
  const state = await evaluate(`(() => ({
    phase: document.querySelector('#world-root')?.dataset.worldPhase ?? null,
    scene: Boolean(window.__AGEHA_SCENE__),
    info: Boolean(window.__AGEHA_WORLD_INFO__),
  }))()`).catch((error) => ({ error: String(error) }));
  console.error(i, JSON.stringify(state));
  if (state.phase === "ready" && state.scene) break;
  await sleep(1000);
}
console.error("world ready");
await sleep(1500);

const report = await evaluate(`(() => {
  const scene = window.__AGEHA_SCENE__;
  const out = [];
  const v = new (scene.position.constructor)();
  scene.traverse((obj) => {
    if (!obj.isMesh && !obj.isInstancedMesh && !obj.isPoints) return;
    obj.updateWorldMatrix?.(true, false);
    v.setFromMatrixPosition(obj.matrixWorld);
    const x = v.x, y = v.y, z = v.z;
    // 西侧海面区域：x < -20, |z| < 60, y -12..12, 距主岛 20+
    if (x < -20 && Math.abs(z) < 70 && y > -14 && y < 14) {
      let mat = obj.material;
      const mats = Array.isArray(mat) ? mat : [mat];
      out.push({
        type: obj.isInstancedMesh ? "instanced" : obj.isPoints ? "points" : "mesh",
        name: obj.name || "(anon)",
        parent: obj.parent?.name || obj.parent?.type,
        pos: [x.toFixed(1), y.toFixed(1), z.toFixed(1)],
        mats: mats.map((m) => m.color ? "#" + m.color.getHexString() : "?"),
      });
    }
  });
  return out;
})()`);
console.log(JSON.stringify(report, null, 1));
socket.close();
