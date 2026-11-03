/** Production exploration and foreground performance evidence. Never hides scene/UI.
 * Next :3457, isolated Chrome CDP :9223; each --out must be a fresh directory.
 * --group flow|performance|lifecycle|all
 * --heap-at 1,12,24,48 saves separate lifecycle snapshots for growth attribution.
 * --discard-console true is a diagnostic control; raw messages are archived before discarding.
 */
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TRAILS, PROJECT_ISLES, NOOK_CORRIDOR_SAMPLES, TELEPORT_SPOTS } from "../lib/world/layout.ts";
import { createEvidence, summarize } from "./r122-evidence.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const out = option("out", ".r12-shots/r122-d-20261102/run-01");
const group = option("group", "all");
const base = option("url", "http://127.0.0.1:3457");
const port = Number(option("port", "9223"));
const cycles = Number(option("cycles", "5"));
assert.ok(["flow", "performance", "lifecycle", "all"].includes(group));
await mkdir(out);
const evidence = createEvidence(event => appendFileSync(path.join(out, "events.jsonl"), `${JSON.stringify(event)}\n`));
const report = { startedAt: new Date().toISOString(), base, group, environment: {}, stages: [], checks: [], fatal: null };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, page, targetId, current;
let heapSnapshotFile = "heap.heapsnapshot";
const heapAt = option("heap-at", "").split(",").filter(Boolean).map(Number);

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
    pending.delete(message.id);
    clearTimeout(request.timer);
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
  const result = await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression, timeout = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await evaluate(expression)) return; } catch (error) {
      if (!/context|Cannot find|Inspected target navigated/i.test(error.message)) throw error;
    }
    await sleep(200);
  }
  throw new Error(`Timed out: ${expression}`);
}
function begin(name, details = {}) {
  evidence.stage(name);
  current = { name, ...details, screenshots: [], walks: [] };
  report.stages.push(current);
  console.log(`stage: ${name}`);
}
function check(name, passed, details) {
  report.checks.push({ name, passed: Boolean(passed), details });
  if (!passed) console.error(`CHECK FAILED: ${name}`);
}
async function snapshot() {
  return evaluate(`(() => {
    const scene=window.__AGEHA_SCENE__, root=document.querySelector('#world-root');
    const live=new URLSearchParams(location.search).has('debug') && root?.dataset.worldPhase==='ready' && scene?.__r3f?.root?.getState().scene===scene;
    const state=live ? window.__AGEHA_WORLD_STATE__?.() : null;
    const render=live ? window.__AGEHA_WORLD_INFO__?.() : null;
    const camera=live ? scene.__r3f.root.getState().camera : null;
    const project=p=>{if(!camera)return null;const v=scene.position.clone().set(p.x,p.y,p.z).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,depth:v.z};};
    const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    return {url:location.href,phase:root?.dataset.worldPhase,panel:root?.dataset.panelOpen,
      state,render,visibility:document.visibilityState,focus:document.hasFocus(),
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth},
      playerScreen:state ? project(state.player) : null,
      zone:document.querySelector('.world-hud__zone')?.textContent,
      prompt:document.querySelector('.world-hud__prompt-btn')?.textContent,
      detail:document.querySelector('[data-world-panel="detail"].world-panel--open .world-panel__title')?.textContent,
      joystick:rect(document.querySelector('.world-joystick')),
      intro:!!document.querySelector('.world-toast'),
      glResources:window.__R122_GL_COUNTS__,
      memory:performance.memory ? {used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize} : null};
  })()`);
}
async function capture(name) {
  const state = await snapshot();
  const result = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(out, `${name}.png`), Buffer.from(result.data, "base64"));
  current.screenshots.push({ file: `${name}.png`, at: new Date().toISOString(), ...state });
  if(state.playerScreen) check(`${name}: player remains in frame`,state.playerScreen.depth>-1&&state.playerScreen.depth<1&&state.playerScreen.x>=0&&state.playerScreen.x<=state.viewport.width&&state.playerScreen.y>=0&&state.playerScreen.y<=state.viewport.height*.9,state.playerScreen);
  await writeFile(path.join(out, "report.partial.json"), JSON.stringify(report, null, 2));
  console.log(`screenshot: ${name}`);
  return state;
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',behavior:'instant'})`);
  await sleep(120);
  const point = await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);return {x,y,hit:hit===e||e.contains(hit)};})()`);
  assert.ok(point?.hit, `UI not hittable: ${selector}`);
  for (const type of ["mousePressed", "mouseReleased"]) await page.send("Input.dispatchMouseEvent", { type, x: point.x, y: point.y, button: "left", clickCount: 1 });
  await sleep(450);
}
async function viewport(mobile = false, reduce = false) {
  await page.send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 3 : 1, mobile });
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }] });
}
async function open(query = "") {
  const start = Date.now();
  const navigation = await page.send("Page.navigate", { url: `${base}/?debug=1${query}` });
  assert.ok(!navigation.errorText,navigation.errorText);
  await waitFor("document.querySelector('#world-root')?.dataset.worldPhase==='ready' && !!window.__AGEHA_WORLD_INFO__");
  await waitFor("!!document.querySelector('.world-toast__cancel')");
  current.readyMs = Date.now() - start;
  await click(".world-toast__cancel");
  await sleep(1800);
}
async function key(code, duration = 80, settle = 300) {
  const key = code === "Escape" ? "Escape" : code.startsWith("Digit") ? code.slice(-1) : code.slice(3).toLowerCase();
  const params = { code, key, windowsVirtualKeyCode: code === "Escape" ? 27 : key.toUpperCase().charCodeAt(0) };
  await page.send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  try { await sleep(duration); } finally { await page.send("Input.dispatchKeyEvent", { ...params, type: "keyUp" }); }
  await sleep(settle);
}
async function walkTo(x, z, tolerance = 0.55) {
  const steps = [];
  for (let i = 0; i < 40; i++) {
    const state = await evaluate("window.__AGEHA_WORLD_STATE__()");
    const dx=x-state.player.x, dz=z-state.player.z, distance=Math.hypot(dx,dz);
    if (distance < tolerance) break;
    const yaw=state.cameraState.yaw;
    const forward=-Math.sin(yaw)*dx-Math.cos(yaw)*dz, right=Math.cos(yaw)*dx-Math.sin(yaw)*dz;
    const code=Math.abs(forward)>Math.abs(right) ? forward>0?"KeyW":"KeyS" : right>0?"KeyD":"KeyA";
    steps.push({ player: state.player, ground: state.ground, code });
    await key(code, Math.min(220,Math.max(65,distance*65)),300);
  }
  const state=await evaluate("window.__AGEHA_WORLD_STATE__()");
  const distance=Math.hypot(x-state.player.x,z-state.player.z);
  const walk={target:{x,z},steps,final:state.player,ground:state.ground,distance};
  current.walks.push(walk);
  check(`${current.name}: walk ${x.toFixed(2)},${z.toFixed(2)}`,distance<0.9,walk);
  assert.ok(distance<0.9,`Route stopped at ${JSON.stringify(walk.final)} before ${x},${z}`);
}
async function follow(samples, prefix) {
  for (let i=0;i<samples.length;i+=2) {
    await walkTo(samples[i].x,samples[i].z);
    if (i===Math.floor(samples.length/4)*2) await capture(`${prefix}-midway`);
  }
  const last=samples.at(-1);
  await walkTo(last.x,last.z);
}
async function returnMain() {
  await click('[aria-label="打开世界导航（快捷键 M）"]');
  await click('[aria-label="回航与彩蛋"] button');
  await sleep(1800);
  const state=await snapshot(), p=state.state.player;
  check("return to main spawn",Math.hypot(p.x-6.5,p.z-7)<0.3,state);
}
async function detail(slug, prefix) {
  await waitFor("!!document.querySelector('.world-hud__prompt-btn')",10000);
  // Movement intentionally coasts after key-up; compare settled positions, not residual inertia.
  await sleep(5000);
  const before=(await snapshot()).state.player;
  await click(".world-hud__prompt-btn");
  await waitFor("!!document.querySelector('[data-world-panel=detail].world-panel--open')");
  check(`${slug}: correct detail`,await evaluate(`!!document.querySelector('[data-world-panel=detail].world-panel--open a[href="/projects/${slug}"]')`));
  await capture(`${prefix}-detail`);
  await click('[aria-label="关闭详情，返回探索"]');
  const state=await snapshot(), p=state.state.player;
  check(`${slug}: close preserves position`,!state.detail&&Math.hypot(p.x-before.x,p.z-before.z)<0.05,{before,after:p});
  await capture(`${prefix}-return-explore`);
}
async function sample(name, duration=10000) {
  await page.send("Page.bringToFront");
  const result=await evaluate(`new Promise(resolve=>{
    const intervals=[],renders=[],visibility=[];let start,last;
    const tick=now=>{if(start===undefined){start=now;last=now;}else{intervals.push(now-last);last=now;}
      visibility.push(document.visibilityState);if(renders.length===0||now-start>=renders.length*1000)renders.push({at:now-start,...window.__AGEHA_WORLD_INFO__()});
      if(now-start>=${duration}){const sorted=[...intervals].sort((a,b)=>a-b);resolve({elapsed:now-start,intervals,renders,visibility:[...new Set(visibility)],focus:document.hasFocus(),avgMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),fps:1000*intervals.length/(now-start),long33:intervals.filter(n=>n>33.4).length,long50:intervals.filter(n=>n>50).length});}
      else requestAnimationFrame(tick);};requestAnimationFrame(tick);
  })`);
  current.samples??=[];
  current.samples.push({name,...result});
  check(`${name}: foreground sample`,result.visibility.length===1&&result.visibility[0]==="visible"&&result.focus&&result.intervals.length>10,{visibility:result.visibility,focus:result.focus});
  console.log(`performance ${name}: ${result.fps.toFixed(1)}fps avg=${result.avgMs.toFixed(2)} p95=${result.p95Ms.toFixed(2)}`);
  return result;
}

try {
  const version=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  browser=await connect(version.webSocketDebuggerUrl);
  report.environment.browser=await browser.send("Browser.getVersion");
  report.environment.system=await browser.send("SystemInfo.getInfo");
  ({targetId}=await browser.send("Target.createTarget",{url:"about:blank"}));
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl,e=>{
    if(e.method==="HeapProfiler.addHeapSnapshotChunk")appendFileSync(path.join(out,heapSnapshotFile),e.params.chunk);
    else evidence.receive(e);
  });
  for(const method of ["Page.enable","Runtime.enable","Network.enable","Log.enable"])await page.send(method);
  // Count native GPU object ownership across SPA unmounts without retaining GL contexts/objects.
  await page.send("Page.addScriptToEvaluateOnNewDocument",{source:`(()=>{
    window.__R122_GL_COUNTS__=[];const contexts=new WeakMap();
    for(const Type of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
      if(!Type)continue;for(const kind of ['Buffer','Texture','Program','Framebuffer','Renderbuffer','VertexArray','Shader']){
        const proto=Type.prototype,create=proto['create'+kind],dispose=proto['delete'+kind];
        if(!Object.hasOwn(proto,'create'+kind)||!create||!dispose)continue;
        const owned=new WeakSet();
        proto['create'+kind]=function(...args){const result=create.apply(this,args);if(result){let row=contexts.get(this);if(!row){row={contextLost:false};contexts.set(this,row);window.__R122_GL_COUNTS__.push(row);this.canvas.addEventListener('webglcontextlost',()=>{row.contextLost=true;},{once:true});}row[kind]=(row[kind]||0)+1;owned.add(result);}return result;};
        proto['delete'+kind]=function(object){if(object&&owned.has(object)){owned.delete(object);contexts.get(this)[kind]--;}return dispose.call(this,object);};
      }
    }
  })();`});
  await page.send("Emulation.setFocusEmulationEnabled",{enabled:true});
  await page.send("Page.bringToFront");
  await viewport();
  if(group==="flow"||group==="all") {
    begin("desktop-entry");await open();await capture("01-desktop-entry");
    for(const id of ["trail-a","trail-m","trail-c"]) {
      const trail=TRAILS.find(t=>t.id===id),isle=PROJECT_ISLES.find(i=>i.id===trail.targetIsleId);
      begin(`walk-${id}`,{route:trail.samples});
      await evaluate(`window.__R122_ROUTE_TRACE__={active:true,intervals:[],renders:[]};requestAnimationFrame(function tick(now){
        const t=window.__R122_ROUTE_TRACE__;if(!t.active)return;
        if(t.last!==undefined)t.intervals.push(now-t.last);t.last=now;
        if(t.renders.length===0||now-t.renders.at(-1).at>1000)t.renders.push({at:now,visibility:document.visibilityState,...window.__AGEHA_WORLD_INFO__()});
        requestAnimationFrame(tick);
      })`);
      if(id==="trail-a"){await walkTo(0,0);await walkTo(-4.8,-7.5);}
      if(id==="trail-m"){await walkTo(10,7);}
      if(id==="trail-c"){await walkTo(0,0);await walkTo(-10,4);}
      await follow(trail.samples,id);
      await walkTo(isle.center.x+isle.anchor.offsetX,isle.center.z+isle.anchor.offsetZ,0.8);
      current.routeFrames=await evaluate(`(()=>{const t=window.__R122_ROUTE_TRACE__;t.active=false;return t;})()`);
      await capture(`${id}-arrival`);
      await detail(isle.slug,id);
      await returnMain();await capture(`${id}-main-return`);
    }
    begin("gallery-natural-entry",{route:NOOK_CORRIDOR_SAMPLES});
    await walkTo(0,0);await walkTo(-11,-3);await follow(NOOK_CORRIDOR_SAMPLES,"gallery");
    await capture("gallery-discovered");
    await click('[aria-label="打开世界导航（快捷键 M）"]');
    check("gallery discovered enables teleport",await evaluate(`Array.from(document.querySelectorAll('[aria-label="回航与彩蛋"] button')).some(e=>e.textContent.includes('茧居所'))`));
    await capture("gallery-nav-unlocked");await key("Escape");await returnMain();
    begin("teleport-all-destinations");
    for(let i=0;i<PROJECT_ISLES.length;i++) {
      await key(`Digit${i+1}`);await sleep(1600);
      const s=await snapshot(),spot=TELEPORT_SPOTS.find(t=>t.id===PROJECT_ISLES[i].id);
      check(`teleport ${spot.id}`,Math.hypot(s.state.player.x-spot.x,s.state.player.z-spot.z)<0.3,s);
      await capture(`teleport-${spot.id}`);
    }
    await returnMain();
    await click('[aria-label="打开世界导航（快捷键 M）"]');
    await click('[aria-label="回航与彩蛋"] button:nth-child(2)');await sleep(1600);
    const gallery=await capture("gallery-teleport");
    check("gallery teleport lower layer",gallery.state.player.y < -16,gallery.state);
    await returnMain();
  }
  if(group==="performance"||group==="all") {
    for(const [name,mobile,reduce,query] of [
      ["desktop-auto",false,false,""],["mobile-auto",true,false,""],
      ["desktop-low",false,false,"&tier=low"],["desktop-reduced",false,true,""]]) {
      begin(name,{mobile,reduce,query});await viewport(mobile,reduce);await open(query);
      await sleep(5000);await capture(`${name}-steady`);
      await sample(name);await sample(`${name}-repeat`);
      if(name==="desktop-reduced") {
        await key("Digit1");await sleep(500);
        const before=(await snapshot()).state.player;
        await key("KeyW",700,600);
        const moved=await capture("reduced-motion-controls");
        check("reduced motion retains movement",Math.hypot(before.x-moved.state.player.x,before.z-moved.state.player.z)>1,{before,after:moved.state.player});
        await key("KeyR");await sleep(1200);
        const reset=await snapshot();
        check("reduced motion respawn",Math.hypot(reset.state.player.x-6.5,reset.state.player.z-7)<0.3,reset);
      }
      if(mobile){
        const before=(await snapshot()).state.player;
        const r=await evaluate(`(()=>{const r=document.querySelector('.world-joystick').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
        await page.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{...r,id:1}]});
        await page.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:r.x,y:r.y-32,id:1}]});
        await sleep(1800);await page.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await sleep(600);
        const s=await capture("mobile-joystick-moved");
        check("mobile real touch joystick movement",Math.hypot(before.x-s.state.player.x,before.z-s.state.player.z)>1,{before,after:s.state.player});
        await click('[aria-label="打开世界导航（快捷键 M）"]');await capture("mobile-nav");
        await click('.world-nav__card:nth-child(1) .world-nav__card-btn:nth-child(2)');await capture("mobile-detail");
        await click('[aria-label="关闭详情，返回探索"]');
      }
    }
    begin("automatic-downgrade-stress",{cpuRate:6,extraMainThreadBusyMsPerFrame:35,synthetic:true});
    await viewport();await open();
    await page.send("Emulation.setCPUThrottlingRate",{rate:6});
    await evaluate(`window.__R122_STOP_STRESS__=false;requestAnimationFrame(function busy(){const start=performance.now();while(performance.now()-start<35){}if(!window.__R122_STOP_STRESS__)requestAnimationFrame(busy);})`);
    try {await sample("stress-adaptation",40000);await capture("auto-downgrade-low");
      check("automatic downgrade reaches low",(await snapshot()).render.tier==="low",await snapshot());
      const late=current.samples[0].renders.filter(r=>r.at>25000&&r.tier==="low");
      check("low DPR remains capped after HUD rerenders",late.length>5&&late.every(r=>r.dpr<=.85),late);
      await page.send("Emulation.setDeviceMetricsOverride",{width:1366,height:900,deviceScaleFactor:1,mobile:false});
      await sleep(1000);
      const resized=await capture("low-tier-after-resize");
      check("resize preserves low DPR",resized.render.tier==="low"&&resized.render.dpr<=.85,resized.render);
    } finally {await evaluate("window.__R122_STOP_STRESS__=true");await page.send("Emulation.setCPUThrottlingRate",{rate:1});}
    await sleep(3000);await sample("post-stress-recovery",10000);await capture("post-stress-recovery");
  }
  if(group==="lifecycle"||group==="all") {
    const discardConsole = option("discard-console", "false") === "true";
    begin("spa-lifecycle",{cycles,discardConsole});await viewport(false,true);await open("&tier=high");
    await evaluate(`(()=>{const textures=new Set(),scene=window.__AGEHA_SCENE__,gl=scene.__r3f.root.getState().gl;scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;if(m.map?.image?.src?.includes('/world/'))textures.add(m.map);const lut=gl.properties.get(m).uniforms?.dfgLUT?.value;if(lut)textures.add(lut);}});window.__R122_CACHED_TEXTURES__=[...textures];})()`);
    current.cycles=[];
    for(let i=0;i<=cycles;i++) {
      await sleep(2000);
      if(discardConsole) {
        evidence.stage(`diagnostic-console-discard-${i}`); // Prior messages remain in events.jsonl.
        await page.send("Runtime.discardConsoleEntries");
        evidence.stage("spa-lifecycle");
      }
      await page.send("HeapProfiler.collectGarbage");
      const heap=await page.send("Runtime.getHeapUsage");
      // Read the current renderer directly: normal SPA return intentionally has no debug query.
      const live=await evaluate(`(()=>({canvases:document.querySelectorAll('canvas').length,phase:document.querySelector('#world-root')?.dataset.worldPhase,heap:performance.memory?.usedJSHeapSize,domNodes:document.getElementsByTagName('*').length,glResources:window.__R122_GL_COUNTS__,cachedTextureListeners:window.__R122_CACHED_TEXTURES__.map(t=>({url:t.image?.src??t.name,dispose:t._listeners?.dispose?.length??0}))}))()`);
      const dom=await page.send("Memory.getDOMCounters");
      current.cycles.push({cycle:i,heap,live,dom});
      if(heapAt.includes(i)) {
        heapSnapshotFile=`heap-cycle-${i}.heapsnapshot`;
        await page.send("HeapProfiler.takeHeapSnapshot",{reportProgress:false});
        current.cycles.at(-1).afterSnapshot=await page.send("Runtime.getHeapUsage");
      }
      console.log(`lifecycle ${i}: heapMiB=${(heap.usedSize/1048576).toFixed(2)} nodes=${dom.nodes} activeGL=${live.glResources.filter(r=>!r.contextLost).length}`);
      const initialListeners=current.cycles[0].live.cachedTextureListeners;
      check(`SPA cycle ${i}: cached textures release old renderers`,live.cachedTextureListeners.length>0&&live.cachedTextureListeners.every(t=>t.dispose<=(initialListeners.find(b=>b.url===t.url)?.dispose??0)),live.cachedTextureListeners);
      check(`SPA cycle ${i}: one active WebGL context`,live.glResources.filter(r=>!r.contextLost).length===1,live.glResources);
      check(`SPA cycle ${i}: ready single canvas`,live.phase==="ready"&&live.canvases===1,live);
      if(i===0||i===cycles)await capture(`lifecycle-${i}`);
      if(i===cycles)break;
      await click('a[href="/about"]');await waitFor("location.pathname==='/about'&&!document.querySelector('#world-root')");
      await sleep(1000);await page.send("HeapProfiler.collectGarbage");
      current.cycles.at(-1).unmounted={heap:await page.send("Runtime.getHeapUsage"),dom:await page.send("Memory.getDOMCounters")};
      await click('a[href="/"]');await waitFor("document.querySelector('#world-root')?.dataset.worldPhase==='ready'");
      await waitFor("!!document.querySelector('.world-toast__cancel')");await click('.world-toast__cancel');
    }
    const tail=current.cycles.slice(1).slice(-5); // Exclude the first cache/debug warm-up cycle.
    check("SPA detached DOM count reaches a plateau",Math.max(...tail.map(c=>c.dom.nodes))-Math.min(...tail.map(c=>c.dom.nodes))<=64,tail.map(c=>({cycle:c.cycle,nodes:c.dom.nodes})));
    if(option("heap","false")==="true") {
      heapSnapshotFile="heap.heapsnapshot";
      await page.send("HeapProfiler.takeHeapSnapshot",{reportProgress:false});
    }
  }
} catch(error) {report.fatal=error.stack??String(error);console.error(report.fatal);process.exitCode=1;}
finally {
  if(page){await sleep(500);page.socket.close();}
  if(browser){if(targetId)await browser.send("Target.closeTarget",{targetId});browser.socket.close();}
  report.finishedAt=new Date().toISOString();report.summary=summarize(evidence.events);
  for(const stage of report.stages)stage.logs=summarize(evidence.events.filter(e=>e.stage===stage.name));
  report.checksPassed=report.checks.every(c=>c.passed);
  await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify({out,fatal:report.fatal,checks:report.checks.length,checksPassed:report.checksPassed,summary:report.summary}));
  if(!report.checksPassed)process.exitCode=1;
}
