/** Production evidence, no scene/UI hiding. Start Next :3457 and isolated Chrome CDP :9223.
 * node scripts/capture-r122-a.mjs --out .r12-shots/r122-a-20261102/capture-01
 * --group art|default|probes|client|framing|edge|north|all; each invocation requires a new output directory.
 */
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createEvidence, summarize } from "./r122-evidence.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const out = option("out", ".r12-shots/r122-a-20261102/capture-01");
const base = option("url", "http://127.0.0.1:3457");
const port = Number(option("port", "9223"));
const group = option("group", "all");
assert.ok(["all", "art", "default", "probes", "client", "framing", "edge", "north"].includes(group));
await mkdir(out); // Fail rather than overwrite any earlier run.
const evidence = createEvidence(event => appendFileSync(path.join(out, "events.jsonl"), `${JSON.stringify(event)}\n`));
const report = { startedAt: new Date().toISOString(), base, group, environment: {}, stages: [], checks: [], fatal: null };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect(url, onEvent = () => {}) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return onEvent(message);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  return {
    socket,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${method} timeout`)); }, 30000);
        pending.set(requestId, { resolve, reject, timer });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
  };
}

let browser;
let page;
let targetId;
let current;
const evaluate = async expression => {
  const result = await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
async function waitFor(expression, timeout = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await evaluate(expression)) return; } catch (error) {
      if (!/context|Cannot find|Inspected target navigated/i.test(error.message)) throw error;
    }
    await sleep(250);
  }
  throw new Error(`Timed out: ${expression}`);
}
function begin(name, details = {}) {
  evidence.stage(name);
  current = { name, ...details, startedAt: new Date().toISOString(), screenshots: [] };
  report.stages.push(current);
}
function check(name, passed, details) { report.checks.push({ name, passed: Boolean(passed), details }); }
function checkFraming(name, shot, width, height) {
  const f=shot.framing;
  const overlap=(a,b)=>a && b && a.x<b.right && a.right>b.x && a.y<b.bottom && a.bottom>b.y;
  check(`${name}: butterfly clears navigation`, f && f.butterfly.y>=f.nav.bottom+12, f);
  check(`${name}: full butterfly in viewport`, f && f.butterfly.x>=0 && f.butterfly.right<=width && f.butterfly.bottom<=height, f);
  check(`${name}: region label clears butterfly and navigation`, f && !overlap(f.zone,f.butterfly) && !overlap(f.zone,f.nav), f);
}
async function viewport(width, height, mobile, reduce) {
  await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }] });
}
async function open(name, query = "", details = {}) {
  begin(name, { query, ...details });
  const navigation = await page.send("Page.navigate", { url: `${base}/?debug=1${query}` });
  assert.ok(!navigation.errorText, navigation.errorText);
  await waitFor("document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && typeof window.__AGEHA_WORLD_INFO__ === 'function'");
  await waitFor("Boolean(document.querySelector('.world-toast__cancel'))");
  await sleep(900);
}
async function click(selector) {
  const point = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  assert.ok(point, `Missing UI: ${selector}`);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
  await sleep(450);
}
async function closeIntro() {
  await click(".world-toast__cancel");
  await waitFor("!document.querySelector('.world-toast')");
}
async function key(code, ms) {
  const key = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d", KeyR: "r" }[code];
  const params = { code, key, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) };
  await page.send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  try { await sleep(ms); } finally { await page.send("Input.dispatchKeyEvent", { ...params, type: "keyUp" }); }
  await sleep(700);
}
async function walkTo(x, z) {
  const steps = [];
  for (let i = 0; i < 18; i += 1) {
    const state = await evaluate("window.__AGEHA_WORLD_STATE__()");
    const dx = x - state.player.x;
    const dz = z - state.player.z;
    if (Math.hypot(dx, dz) < 0.9) break;
    const yaw = state.cameraState.yaw;
    const forward = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
    const right = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
    const code = Math.abs(forward) > Math.abs(right) ? (forward > 0 ? "KeyW" : "KeyS") : (right > 0 ? "KeyD" : "KeyA");
    steps.push({ player: state.player, code });
    await key(code, Math.min(220, Math.max(70, Math.hypot(dx, dz) * 35)));
  }
  const state = await evaluate("window.__AGEHA_WORLD_STATE__()");
  current.walk = { target: { x, z }, steps, final: state.player, distance: Math.hypot(x - state.player.x, z - state.player.z) };
  check(`${current.name}: reached via keyboard`, current.walk.distance < 1.2, current.walk);
}
async function surfaceProbe() {
  // Read the actual rendered main-island triangle under the player; no scene mutations.
  current.surface = await evaluate(`(() => {
    const state = window.__AGEHA_WORLD_STATE__();
    const scene = window.__AGEHA_SCENE__;
    const p = state.player;
    const hits = [];
    scene.traverse(mesh => {
      if (!mesh.isMesh || mesh.isInstancedMesh || !mesh.geometry) return;
      const g = mesh.geometry;
      g.computeBoundingBox();
      const b = g.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      if (b.max.x - b.min.x < 30 || b.max.z - b.min.z < 20 || b.min.y < -2 || b.max.y > 5) return;
      const position = g.getAttribute('position');
      const count = g.index ? g.index.count : position.count;
      const v = [scene.position.clone(), scene.position.clone(), scene.position.clone()];
      for (let i = 0; i < count; i += 3) {
        for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(position, g.index ? g.index.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld);
        const [a,b,c] = v;
        const d = (b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
        if (Math.abs(d) < 1e-10) continue;
        const u = ((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/d;
        const w = ((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/d;
        if (u >= -1e-6 && w >= -1e-6 && u+w <= 1+1e-6) hits.push(u*a.y+w*b.y+(1-u-w)*c.y);
      }
    });
    const renderedGroundY = hits.length ? Math.max(...hits) : null;
    return { player: p, analyticalGroundY: state.ground, renderedGroundY,
      renderedMinusAnalytical: renderedGroundY === null ? null : renderedGroundY - state.ground,
      hoverAboveRendered: renderedGroundY === null ? null : p.y-renderedGroundY };
  })()`);
  check(`${current.name}: rendered surface measurable`, current.surface.renderedGroundY !== null, current.surface);
}
async function capture(name) {
  const snapshot = await evaluate(`(() => {
    const diagnosticsEnabled = location.pathname === '/' && new URLSearchParams(location.search).has('debug') && document.querySelector('#world-root')?.dataset.worldPhase === 'ready';
    const state = diagnosticsEnabled ? window.__AGEHA_WORLD_STATE__?.() : null;
    const plate = document.querySelector('.world-nameplate--quiet');
    const r = plate?.getBoundingClientRect();
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const rect = e => { const r = e?.getBoundingClientRect(); return r ? { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom } : null; };
    let framing = null;
    if (${group === "framing" || group === "default"}) {
      const scene = window.__AGEHA_SCENE__;
      const camera = scene?.__r3f?.root?.getState().camera;
      const butterfly = scene?.getObjectByName('butterfly-sculpture');
      if (camera && butterfly) {
        let left=Infinity, top=Infinity, right=-Infinity, bottom=-Infinity;
        const v = scene.position.clone();
        butterfly.traverse(mesh => {
          if (!mesh.isMesh || !mesh.geometry) return;
          const points = mesh.geometry.getAttribute('position');
          for (let i=0;i<points.count;i++) {
            v.fromBufferAttribute(points,i).applyMatrix4(mesh.matrixWorld).project(camera);
            const x=(v.x+1)*innerWidth/2, y=(1-v.y)*innerHeight/2;
            left=Math.min(left,x); top=Math.min(top,y); right=Math.max(right,x); bottom=Math.max(bottom,y);
          }
        });
        framing = { butterfly:{x:left,y:top,right,bottom,width:right-left,height:bottom-top},
          nav:rect(document.querySelector('header nav')), zone:rect(document.querySelector('.world-hud__zone')) };
      }
    }
    return { state, render: diagnosticsEnabled ? window.__AGEHA_WORLD_INFO__?.() : null, diagnosticsEnabled,
      url: location.href, visibility: document.visibilityState, motion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, introVisible: Boolean(document.querySelector('.world-toast')),
      nameplate: r ? { opacity: getComputedStyle(plate).opacity, visibility: getComputedStyle(plate).visibility, rect: { x: r.x, y: r.y, width: r.width, height: r.height } } : null,
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, framing };
  })()`);
  const shot = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const file = `${name}.png`;
  await writeFile(path.join(out, file), Buffer.from(shot.data, "base64"));
  const item = { file, at: new Date().toISOString(), ...snapshot };
  current.screenshots.push(item);
  await writeFile(path.join(out, "report.partial.json"), JSON.stringify(report, null, 2));
  console.log(`${file}: tier=${snapshot.render?.tier}, camera=${JSON.stringify(snapshot.state?.camera)}`);
  return item;
}

// Reframed poses are new acceptance views, not same-camera before/after images.
const POSES = {
  "02-island-front": "0,4.5,42,0,1.5,0",
  "03-island-side-west": "-48,7,10,0,1,-2",
  "12-rim-underside": "-34,-5.5,16,-4,-4,-2",
  "13-rim-close": "-30,0.8,16,-16,-2.5,5",
  "14a-pine-spire-reframed": "-22,4.8,-8,-14.6,3.3,-0.6",
  "14b-pine-broad-reframed": "20,4,3,13.8,2.1,-2.7",
  "14c-pine-tuft-reframed": "-2.5,2.3,12.3,-4.6,1,8.7",
  "15-rocks-fusion-reframed": "16,5,-11,11.1,1.7,-6.8",
};

try {
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  browser = await connect(version.webSocketDebuggerUrl);
  report.environment.browser = await browser.send("Browser.getVersion");
  report.environment.system = await browser.send("SystemInfo.getInfo");
  ({ targetId } = await browser.send("Target.createTarget", { url: "about:blank" }));
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  page = await connect(targets.find(t => t.id === targetId).webSocketDebuggerUrl, message => evidence.receive(message));
  for (const domain of ["Page", "Runtime", "Network", "Log"]) await page.send(`${domain}.enable`);
  await page.send("Page.bringToFront");
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  if(group==="north") {
    await viewport(1440,900,false,true);
    await open("north-home-reference");
    await closeIntro();
    await capture("50-home-reference");
    for(const [name,pose] of Object.entries({
      "51-north-edge-east":"-1.2,2.6,-8,-5.5,0.5,-9.5",
      "52-north-edge-west":"-9,2.5,-8,-5.5,0.5,-9.5",
      "53-north-overview":"-4,8,-5,-5.3,0.4,-9",
    })) {
      await open(name,`&cam=${encodeURIComponent(pose)}`);
      await closeIntro();
      if(name==="51-north-edge-east") {
        current.roadSurvey=await evaluate(`(() => {
          const scene=window.__AGEHA_SCENE__;
          const state=scene.__r3f.root.getState();
          const ray=new state.raycaster.constructor();
          const road=scene.getObjectByName('approach-a-pavement');
          let snow;
          scene.traverse(mesh=>{if(!mesh.isMesh||mesh.isInstancedMesh||!mesh.geometry)return;mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;if(b.max.x-b.min.x>30&&b.max.z-b.min.z>20&&b.min.y>-2&&b.max.y<5)snow=mesh;});
          const height=(mesh,x,z)=>{ray.set(state.camera.position.clone().set(x,10,z),state.camera.position.clone().set(0,-1,0));return ray.intersectObject(mesh,false)[0]?.point.y??null;};
          const p=road.geometry.getAttribute('position');
          const stride=p.count/49;
          const samples=[];
          for(let i=8;i<44;i+=4)for(const u of [.02,.5,.98]) {
            const a=state.camera.position.clone().fromBufferAttribute(p,i*stride).lerp(state.camera.position.clone().fromBufferAttribute(p,i*stride+stride-1),u);
            const b=state.camera.position.clone().fromBufferAttribute(p,(i+1)*stride).lerp(state.camera.position.clone().fromBufferAttribute(p,(i+1)*stride+stride-1),u);
            a.lerp(b,.5).applyMatrix4(road.matrixWorld);
            const roadY=height(road,a.x,a.z),snowY=height(snow,a.x,a.z);
            samples.push({row:i,u,x:a.x,z:a.z,roadY,snowY,gap:roadY===null||snowY===null?null:roadY-snowY});
          }
          return {roadMaterial:{color:road.material.color.getHexString(),roughness:road.material.roughness},samples};
        })()`);
        const measured=current.roadSurvey.samples.filter(s=>s.gap!==null);
        check("north surface follows terrain across full width",measured.length===27 && measured.every(s=>s.gap>=-.03&&s.gap<=.12),{min:Math.min(...measured.map(s=>s.gap)),max:Math.max(...measured.map(s=>s.gap)),count:measured.length});
      }
      await capture(name);
    }
    await viewport(390,844,true,true);
    await open("north-mobile-edge","&cam=-1.2,2.6,-8,-5.5,0.5,-9.5");
    await closeIntro();
    await capture("54-north-mobile-edge");
    await viewport(1440,900,false,false);
    await open("north-player-approach");
    await closeIntro();
    await walkTo(0,0);
    await walkTo(-4.8,-7.5);
    await capture("55-player-north-approach");
    begin("north-player-outbound");
    await walkTo(-5.8,-11.4);
    await walkTo(-6.8,-14.5);
    await capture("56-player-north-outbound");
    begin("north-player-return");
    await walkTo(-5.8,-11.4);
    await walkTo(-4.8,-7.5);
    await capture("57-player-north-return");
  }
  if(group==="edge") {
    await viewport(1440,900,false,false);
    await open("brand-edge-visible");
    await closeIntro();
    await walkTo(4.8,4.5);
    await page.send("Input.dispatchMouseEvent",{type:"mouseWheel",x:720,y:500,deltaX:0,deltaY:-180});
    await sleep(1200);
    const visible=await capture("48-brand-in-frame");
    check("in-frame brand caption remains visible",visible.nameplate?.visibility==="visible",visible.nameplate);
    begin("brand-edge-offscreen");
    await page.send("Input.dispatchMouseEvent",{type:"mousePressed",x:450,y:400,button:"left",clickCount:1});
    for(let i=1;i<=14;i++)await page.send("Input.dispatchMouseEvent",{type:"mouseMoved",x:450+i*50,y:400,button:"left",buttons:1});
    await page.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:1150,y:400,button:"left",clickCount:1});
    await sleep(1200);
    const hidden=await capture("49-brand-anchor-offscreen");
    check("offscreen world anchor hides incomplete caption",hidden.nameplate?.visibility==="hidden" && Number(hidden.nameplate.opacity)===0,hidden.nameplate);
  }
  if (group === "framing") {
    for (const [device,width,height,mobile] of [["desktop",1440,900,false],["wide",2560,1440,false],["mobile",390,844,true]]) {
      await viewport(width,height,mobile,true);
      await open(`framing-${device}-intro`);
      const intro = await capture(`40-${device}-intro`);
      check(`${device}: live framing probe`, intro.framing !== null, intro.framing);
      begin(`framing-${device}-closed`);
      await closeIntro();
      const shot = await capture(`41-${device}-closed`);
      checkFraming(device,shot,width,height);
      if (!mobile && device === "desktop") {
        begin("framing-first-move");
        const sampling = evaluate(`new Promise(resolve => { const states=[]; let n=0; const tick=()=>{ states.push({at:performance.now(),...window.__AGEHA_WORLD_STATE__()}); if(++n>=45)resolve(states);else requestAnimationFrame(tick); }; tick(); })`);
        await key("KeyW",200);
        const states = await sampling;
        const deltas = states.slice(1).map((s,i)=>Math.hypot(s.camera.x-states[i].camera.x,s.camera.y-states[i].camera.y,s.camera.z-states[i].camera.z));
        check("first move: no camera reset jump", Math.max(...deltas)<1, {maxStep:Math.max(...deltas),states});
        await capture("42-first-move");
        begin("framing-scroll");
        await page.send("Input.dispatchMouseEvent",{type:"mouseWheel",x:720,y:500,deltaX:0,deltaY:180});
        await sleep(1200);
        const zoomed=await capture("43-zoom-out");
        check("scroll changes camera distance",zoomed.state.cameraState.distanceIndex===2,zoomed.state);
      }
      if (mobile) {
        begin("framing-mobile-pinch");
        await page.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:140,y:380},{x:230,y:380}]});
        for(let i=1;i<=6;i++)await page.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:140-i*10,y:380},{x:230+i*10,y:380}]});
        await page.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
        await sleep(1200);
        const pinched=await capture("43a-mobile-pinch");
        check("mobile pinch changes camera distance",pinched.state.cameraState.distanceIndex===2,pinched.state);
        begin("framing-mobile-orbit");
        const yaw=pinched.state.cameraState.yaw;
        await page.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:140,y:380}]});
        for(let i=1;i<=8;i++)await page.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:140+i*16,y:380}]});
        await page.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
        await sleep(1200);
        const orbited=await capture("43b-mobile-orbit");
        check("mobile drag rotates camera",Math.abs(orbited.state.cameraState.yaw-yaw)>.2,orbited.state);
      }
    }
    await viewport(1440,900,false,true);
    await open("framing-brand-approach");
    await closeIntro();
    await walkTo(4.8,4.5);
    await page.send("Input.dispatchMouseEvent",{type:"mouseWheel",x:720,y:550,deltaX:0,deltaY:-180});
    await sleep(1300);
    const approach=await capture("44-brand-approach");
    check("brand approach: bounded screen size",approach.nameplate?.rect.width<=240,approach.nameplate);
    check("brand approach: caption fully visible",approach.nameplate?.visibility==="visible" && approach.nameplate.rect.y>=94 && approach.nameplate.rect.y+approach.nameplate.rect.height<=900,approach.nameplate);
    begin("framing-brand-around");
    await walkTo(1,4.5);
    const around=await capture("45-brand-around");
    check("brand around: bounded screen size",around.nameplate?.rect.width<=240,around.nameplate);
    check("brand around: caption fully visible",around.nameplate?.visibility==="visible" && around.nameplate.rect.y>=94 && around.nameplate.rect.y+around.nameplate.rect.height<=900,around.nameplate);
    begin("framing-brand-look-back");
    await page.send("Input.dispatchMouseEvent",{type:"mousePressed",x:600,y:400,button:"left",clickCount:1});
    for(let i=1;i<=8;i++)await page.send("Input.dispatchMouseEvent",{type:"mouseMoved",x:600+i*40,y:400,button:"left",buttons:1});
    await page.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:920,y:400,button:"left",clickCount:1});
    await sleep(1200);
    const back=await capture("46-brand-look-back");
    check("brand look-back: complete caption or offscreen anchor hidden",back.nameplate?.visibility==="hidden" || (back.nameplate?.rect.x>=16 && back.nameplate.rect.x+back.nameplate.rect.width<=1424 && back.nameplate.rect.y>=94 && back.nameplate.rect.y+back.nameplate.rect.height<=884),back.nameplate);
    check("desktop drag rotates camera",Math.abs(back.state.cameraState.yaw-around.state.cameraState.yaw)>.2,back.state);
  }
  if (group === "all" || group === "art") {
    await viewport(1440, 900, false, true);
    await open("art-home", "&tier=high", { purpose: "Fixed high/reduced-motion comparison; intro closed through real UI" });
    await closeIntro();
    await capture("01-home-art");
    for (const [name, pose] of Object.entries(POSES)) {
      await open(`art-${name}`, `&tier=high&cam=${encodeURIComponent(pose)}`, { pose });
      await closeIntro();
      await capture(name);
    }
    await open("art-player", "&tier=high");
    await closeIntro();
    await key("KeyW", 2600);
    await capture("19-player-art");
  }
  if (group === "all" || group === "default") {
    for (const [device, width, height, mobile] of [["desktop", 1440, 900, false], ["desktop-wide", 2560, 1440, false], ["mobile-emulated", 390, 844, true]]) {
      await viewport(width, height, mobile, false);
      await open(`${device}-first-visit`, "", { purpose: "Default automatic quality, normal motion, untouched UI", mobileEmulated: mobile });
      const intro = await capture(`20-${device}-intro`);
      check(`${device}: default motion and real intro`, intro.introVisible && !intro.motion, intro.render);
      begin(`${device}-intro-closed`);
      await closeIntro();
      const closed = await capture(`21-${device}-intro-closed`);
      check(`${device}: intro closes through UI`, !closed.introVisible, closed.state);
      if(group==="default") checkFraming(`${device} normal motion`,closed,width,height);
      if (!mobile && device === "desktop") {
        begin("desktop-player-normal-motion");
        const before = closed.state.player;
        await key("KeyW", 2600);
        const moved = await capture("22-desktop-player-normal-motion");
        check("actual keyboard movement", Math.hypot(moved.state.player.x - before.x, moved.state.player.z - before.z) > 1, { before, after: moved.state.player });
        begin("desktop-return-navigation");
        await page.send("Page.navigate", { url: `${base}/about` });
        await waitFor("location.pathname === '/about' && Boolean(document.querySelector('main'))");
        await capture("23-about-return-path");
        await open("desktop-return-world");
        await capture("24-world-after-return");
      }
    }
  }
  if (group === "all" || group === "probes") {
    await viewport(1440, 900, false, false);
    await open("probe-signpost-approach");
    await closeIntro();
    await walkTo(4.8, 4.5);
    await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 550, deltaX: 0, deltaY: -180 });
    await sleep(1300);
    await capture("30-signpost-approach");
    begin("probe-signpost-around");
    await walkTo(1, 4.5);
    await capture("31-signpost-around");
    begin("probe-signpost-look-back");
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 600, y: 400, button: "left", clickCount: 1 });
    for (let i = 1; i <= 8; i++) await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 600 + i * 40, y: 400, button: "left", buttons: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 920, y: 400, button: "left", clickCount: 1 });
    await sleep(1200);
    await capture("32-signpost-look-back");
    await open("probe-snow-spawn");
    await closeIntro();
    await surfaceProbe();
    await capture("33-snow-spawn");
    begin("probe-snow-ridge");
    await walkTo(0, 9.5);
    await surfaceProbe();
    await capture("34-snow-ridge");
    begin("probe-snow-ridge-cross");
    await walkTo(-1.5, 9.5);
    await surfaceProbe();
    await capture("35-snow-ridge-cross");
  }
  if (group === "all" || group === "probes" || group === "client") {
    // Client navigation exercises React unmount/remount; full Page.navigate is insufficient.
    if (group === "client") {
      await viewport(1440, 900, false, false);
      await open("probe-client-start");
      await closeIntro();
      await capture("36a-client-start");
    }
    begin("probe-client-route-about");
    await click('a[href="/about"]');
    await waitFor("location.pathname === '/about' && !document.querySelector('#world-root')");
    await sleep(1000);
    await capture("36-client-about");
    begin("probe-client-route-home");
    await click('a[href="/"]');
    await waitFor("document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && typeof window.__AGEHA_WORLD_INFO__ === 'function'");
    await waitFor("Boolean(document.querySelector('.world-toast__cancel'))");
    await sleep(1000);
    await capture("37-client-return-world");
    check("client navigation returns ready world", await evaluate("document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && Boolean(document.querySelector('canvas'))"));
    check("normal URL does not reuse stale diagnostics", current.screenshots.at(-1).state === null && current.screenshots.at(-1).render === null);
  }
} catch (error) {
  report.fatal = error.stack ?? String(error);
  console.error(report.fatal);
  process.exitCode = 1;
} finally {
  if (page) {
    await sleep(500);
    page.socket.close();
  }
  if (browser) {
    if (targetId) await browser.send("Target.closeTarget", { targetId });
    browser.socket.close();
  }
  report.finishedAt = new Date().toISOString();
  report.summary = summarize(evidence.events);
  for (const stage of report.stages) stage.logs = summarize(evidence.events.filter(e => e.stage === stage.name));
  report.checksPassed = report.checks.every(c => c.passed);
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, fatal: report.fatal, summary: report.summary, checksPassed: report.checksPassed }));
  if (!report.checksPassed) process.exitCode = 1;
}
