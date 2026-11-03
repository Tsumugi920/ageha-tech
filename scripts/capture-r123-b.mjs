/** Real production tuft-tree evidence. Next :3457, isolated Chrome CDP :9223.
 * --out must be fresh. --expect-covered true checks upper-crown bark exposure.
 * --group survey|walk|supplement|all; fixed cameras never hide scene objects.
 */
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mainIslandSurfaceY } from "../lib/world/layout.ts";
import { createEvidence, summarize } from "./r122-evidence.mjs";

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(`--${key}`) ? args[args.indexOf(`--${key}`) + 1] : fallback;
const out = option("out", ".r12-shots/r123-b-20261102/new-run");
const group = option("group", "all");
const base = option("url", "http://127.0.0.1:3457");
const port = Number(option("port", "9223"));
const spots = [[-4.6, 8.7], [3.4, 9.8], [-9.8, -6.6], [6.2, -10.2], [14.8, 1.4], [-11.9, 4.4]];
assert.ok(["survey", "walk", "supplement", "all"].includes(group));
await mkdir(out);
const evidence = createEvidence(e => appendFileSync(path.join(out, "events.jsonl"), `${JSON.stringify(e)}\n`));
const report = { startedAt: new Date().toISOString(), group, environment: {}, screenshots: [], checks: [], fatal: null };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, page, targetId;
async function connect(url, receive = () => {}) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return receive(message);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  return { socket, send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${method} timeout`)); }, 60000);
      pending.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  } };
}
async function evaluate(expression) {
  const r = await page.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 360; i++) { if (await evaluate(expression)) return; await sleep(250); }
  throw new Error(`Timed out: ${expression}`);
}
function check(name, passed, details) { report.checks.push({ name, passed: Boolean(passed), details }); }
async function click(selector) {
  const p = await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  for (const type of ["mousePressed", "mouseReleased"]) await page.send("Input.dispatchMouseEvent", { type, ...p, button: "left", clickCount: 1 });
  await sleep(450);
}
async function open(name, pose, mobile = false, reduce = true) {
  evidence.stage(name);
  await page.send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }] });
  await page.send("Page.navigate", { url: `${base}/?debug=1&tier=high${pose ? `&cam=${encodeURIComponent(pose)}` : ""}` });
  await waitFor("document.querySelector('#world-root')?.dataset.worldPhase==='ready' && !!window.__AGEHA_WORLD_STATE__ && !!document.querySelector('.world-toast__cancel')");
  await click(".world-toast__cancel"); await sleep(800);
}
async function survey() {
  return evaluate(`(() => {
    const scene=window.__AGEHA_SCENE__,state=scene.__r3f.root.getState(),V=scene.position.constructor,M=scene.matrixWorld.constructor;
    let foliage,trunk;const ground=[];
    scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;if(b.max.x-b.min.x>30&&b.max.z-b.min.z>20&&b.min.y>-2&&b.max.y<5)ground.push(o);});
    scene.traverse(o=>{if(!o.isInstancedMesh)return;const p=o.geometry.parameters;
      if(p?.height===1.15&&p.radiusTop===.07)trunk=o;
      if(o.count===6&&o.geometry.getAttribute('color')){const m=new M();o.getMatrixAt(0,m);m.premultiply(o.matrixWorld);const p=new V().setFromMatrixPosition(m);if(Math.hypot(p.x+4.6,p.z-8.7)<.01)foliage=o;}});
    if(!foliage||!trunk)throw new Error('Main-island tuft/trunk meshes not found');
    const ray=new state.raycaster.constructor(),rows=[];
    for(let i=0;i<foliage.count;i++){
      const m=new M();foliage.getMatrixAt(i,m);m.premultiply(foliage.matrixWorld);const p=new V().setFromMatrixPosition(m);
      let trunkIndex=-1,tm;
      for(let j=0;j<trunk.count;j++){const n=new M();trunk.getMatrixAt(j,n);n.premultiply(trunk.matrixWorld);const q=new V().setFromMatrixPosition(n);if(Math.hypot(p.x-q.x,p.z-q.z)<.001){trunkIndex=j;tm=n;break;}}
      const root=new V(0,-.575,0).applyMatrix4(tm);ray.set(new V(root.x,10,root.z),new V(0,-1,0));const snow=ray.intersectObjects(ground,false)[0];
      const exposed=[];
      for(let y=1.02;y<1.2;y+=.02)for(let a=0;a<Math.PI*2;a+=Math.PI/8){
        const direction=new V(Math.cos(a),0,Math.sin(a));ray.set(direction.clone().multiplyScalar(2).setY(y).applyMatrix4(m),direction.clone().negate().transformDirection(m));
        const leaf=ray.intersectObject(foliage,false).find(h=>h.instanceId===i),bark=ray.intersectObject(trunk,false).find(h=>h.instanceId===trunkIndex);
        if(bark&&(!leaf||bark.distance<leaf.distance-.001))exposed.push({y,angle:a,barkDistance:bark.distance,leafDistance:leaf?.distance??null});
      }
      const bounds=[];const position=foliage.geometry.getAttribute('position');
      for(let j=0;j<position.count;j++){const q=new V().fromBufferAttribute(position,j).applyMatrix4(m).project(state.camera);bounds.push({x:(q.x+1)*innerWidth/2,y:(1-q.y)*innerHeight/2,z:q.z});}
      rows.push({index:i,trunkIndex,base:{x:p.x,y:p.y,z:p.z},foliageMatrix:m.toArray(),trunkMatrix:tm?.toArray(),root:{x:root.x,y:root.y,z:root.z,snowY:snow?.point.y??null,gap:snow?root.y-snow.point.y:null},exposedBarkRays:exposed.length,examples:exposed.slice(0,8),screen:{left:Math.min(...bounds.map(p=>p.x)),right:Math.max(...bounds.map(p=>p.x)),top:Math.min(...bounds.map(p=>p.y)),bottom:Math.max(...bounds.map(p=>p.y))}});
    }
    const trunkMatrices=[];for(let i=0;i<trunk.count;i++){const m=new M();trunk.getMatrixAt(i,m);m.premultiply(trunk.matrixWorld);trunkMatrices.push(m.toArray());}
    return {rows,trunkMatrices,foliageTriangles:foliage.geometry.getAttribute('position').count/3,trunkCount:trunk.count,materialCount:1};
  })()`);
}
async function capture(name, target) {
  const trees = await survey();
  const snapshot = await evaluate(`({state:window.__AGEHA_WORLD_STATE__(),render:window.__AGEHA_WORLD_INFO__(),phase:document.querySelector('#world-root')?.dataset.worldPhase,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}})`);
  const image = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(out, `${name}.png`), Buffer.from(image.data, "base64"));
  report.screenshots.push({ file: `${name}.png`, target, ...snapshot, trees });
  check(`${name}: exactly six original tuft positions`, trees.rows.length === 6 && trees.rows.every((t, i) => Math.hypot(t.base.x - spots[i][0], t.base.z - spots[i][1]) < .001));
  if (target !== undefined) {
    const b = trees.rows[target].screen;
    check(`${name}: full target crown in frame`, b.left > 0 && b.right < snapshot.viewport.width && b.top > 85 && b.bottom < snapshot.viewport.height - 80, b);
  }
  if (option("expect-covered", "false") === "true") check(`${name}: no exposed bark in upper crown`, trees.rows.every(t => t.exposedBarkRays === 0), trees.rows.map(t => ({ index: t.index, rays: t.exposedBarkRays })));
  if (option("expect-contact", "false") === "true") check(`${name}: root centre reaches visible snow`, trees.rows.every(t => t.root.gap !== null && t.root.gap <= .01), trees.rows.map(t => ({ index: t.index, gap: t.root.gap })));
  await writeFile(path.join(out, "report.partial.json"), JSON.stringify(report, null, 2));
  console.log(`${name}: triangles=${trees.foliageTriangles}, exposed=${trees.rows.map(t => t.exposedBarkRays)}`);
}
async function walkTo(x, z) {
  const steps = [];
  for (let i = 0; i < 30; i++) {
    const s = await evaluate("window.__AGEHA_WORLD_STATE__()"), dx = x - s.player.x, dz = z - s.player.z;
    if (Math.hypot(dx, dz) < .45) break;
    const yaw = s.cameraState.yaw, forward = -Math.sin(yaw) * dx - Math.cos(yaw) * dz, right = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
    const code = Math.abs(forward) > Math.abs(right) ? forward > 0 ? "KeyW" : "KeyS" : right > 0 ? "KeyD" : "KeyA";
    const key = code.slice(-1).toLowerCase(), params = { code, key, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) };
    await page.send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
    try { await sleep(Math.min(180, Math.max(55, Math.hypot(dx, dz) * 65))); } finally { await page.send("Input.dispatchKeyEvent", { ...params, type: "keyUp" }); }
    await sleep(1000); steps.push({ code, state: s });
  }
  await sleep(700);
  const final = await evaluate("window.__AGEHA_WORLD_STATE__()");
  report.walks ??= []; report.walks.push({ x, z, steps, final });
  check(`walk reaches ${x},${z}`, Math.hypot(final.player.x - x, final.player.z - z) < 1, final);
}
try {
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); browser = await connect(v.webSocketDebuggerUrl);
  report.environment.browser = await browser.send("Browser.getVersion"); report.environment.system = await browser.send("SystemInfo.getInfo");
  ({ targetId } = await browser.send("Target.createTarget", { url: "about:blank" }));
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); page = await connect(targets.find(t => t.id === targetId).webSocketDebuggerUrl, e => evidence.receive(e));
  for (const method of ["Page.enable", "Runtime.enable", "Network.enable", "Log.enable"]) await page.send(method);
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true }); await page.send("Page.bringToFront");
  if (group === "survey" || group === "all") {
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i], y = mainIslandSurfaceY(x, z);
      await open(`tuft-${i + 1}-front`, [x + 1.5, y + 1.8, z + 2.6, x, y + .55, z].join(",")); await capture(`tuft-${i + 1}-front`, i);
    }
    const [x, z] = spots[0], y = mainIslandSurfaceY(x, z);
    for (const [name, pose, mobile] of [
      ["tuft-1-back", [x - 2, y + 1.8, z - 2.5, x, y + .55, z], false],
      ["tuft-1-mid", [-2.5, 2.3, 12.3, -4.6, 1, 8.7], false],
      ["tuft-1-mobile", [x + 1.5, y + 1.8, z + 2.6, x, y + .55, z], true],
    ]) { await open(name, pose.join(","), mobile); await capture(name, 0); }
  }
  if (group === "supplement" || group === "all") {
    for (const [i, dx, dz] of [[3, -1.5, -2.6], [5, -3, 0.6]]) {
      const [x,z]=spots[i],y=mainIslandSurfaceY(x,z);
      await open(`tuft-${i+1}-side`,[x+dx,y+1.8,z+dz,x,y+.55,z].join(","));
      await capture(`tuft-${i+1}-side`,i);
    }
  }
  if (group === "walk" || group === "all") {
    await open("player-home", null, false, false); await capture("player-home");
    await walkTo(1, 7); await walkTo(-2.9, 8.3); await capture("player-near-tuft");
    await walkTo(-4.2, 10.1); await capture("player-around-tuft");
    await walkTo(-2.9, 8.3); await walkTo(1, 7); await capture("player-return");
  }
} catch (error) { report.fatal = error.stack ?? String(error); console.error(report.fatal); process.exitCode = 1; }
finally {
  if (page) page.socket.close(); if (browser) { if (targetId) await browser.send("Target.closeTarget", { targetId }); browser.socket.close(); }
  report.summary = summarize(evidence.events);
  check("no normal errors or failed requests", ["consoleErrors", "exceptions", "browserErrors", "httpErrors", "networkFailures", "canceledRequests"].every(k => report.summary[k] === 0), report.summary);
  report.finishedAt = new Date().toISOString(); report.checksPassed = report.checks.every(c => c.passed);
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, fatal: report.fatal, checks: report.checks.length, checksPassed: report.checksPassed, summary: report.summary }));
  if (!report.checksPassed) process.exitCode = 1;
}
