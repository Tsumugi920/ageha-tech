/** Production warning/performance evidence. Next :3457, isolated Chrome CDP :9223.
 * Fresh --out; --repeats 3 --duration 30000; --repeats 0 for quick warnings.
 * --sources true archives warning call-site source outside timed samples.
 */
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createEvidence, summarize } from "./r122-evidence.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const out = option("out", ".r12-shots/r123-a-20261102/new-run");
const base = option("url", "http://127.0.0.1:3457");
const port = Number(option("port", "9223"));
const repeats = Number(option("repeats", "3"));
const duration = Number(option("duration", "30000"));
await mkdir(out);
const evidence = createEvidence(e => appendFileSync(path.join(out, "events.jsonl"), `${JSON.stringify(e)}\n`));
const report = { startedAt: new Date().toISOString(), base, repeats, duration, environment: {}, samples: [], screenshots: [], checks: [], fatal: null };
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
  const result = await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  const start = Date.now();
  while (Date.now() - start < 90000) {
    if (await evaluate(expression)) return;
    await sleep(250);
  }
  throw new Error(`Timed out: ${expression}`);
}
function check(name, passed, details) { report.checks.push({ name, passed: Boolean(passed), details }); }
async function state() {
  return evaluate(`(() => {const scene=window.__AGEHA_SCENE__,s=scene.__r3f.root.getState();return {
    state:window.__AGEHA_WORLD_STATE__(),render:window.__AGEHA_WORLD_INFO__(),shadow:{enabled:s.gl.shadowMap.enabled,type:s.gl.shadowMap.type},
    context:s.gl.getContext().getContextAttributes(),precision:s.gl.capabilities.precision,
    visible:document.visibilityState,focus:document.hasFocus(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
    reduce:matchMedia('(prefers-reduced-motion: reduce)').matches,phase:document.querySelector('#world-root')?.dataset.worldPhase};})()`);
}
async function capture(name) {
  const snapshot = await state();
  const result = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(out, `${name}.png`), Buffer.from(result.data, "base64"));
  report.screenshots.push({ file: `${name}.png`, ...snapshot });
}
try {
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  browser = await connect(version.webSocketDebuggerUrl);
  report.environment.browser = await browser.send("Browser.getVersion");
  report.environment.system = await browser.send("SystemInfo.getInfo");
  ({ targetId } = await browser.send("Target.createTarget", { url: "about:blank" }));
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  page = await connect(targets.find(t => t.id === targetId).webSocketDebuggerUrl, e => evidence.receive(e));
  for (const method of ["Page.enable", "Runtime.enable", "Network.enable", "Log.enable"]) await page.send(method);
  if (option("sources", "false") === "true") await page.send("Debugger.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: option("reduce", "false") === "true" ? "reduce" : "no-preference" }] });
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.send("Page.bringToFront");
  evidence.stage("entry");
  const navigation = await page.send("Page.navigate", { url: `${base}/?debug=1&tier=high` });
  assert.ok(!navigation.errorText, navigation.errorText);
  await waitFor("document.querySelector('#world-root')?.dataset.worldPhase==='ready' && !!window.__AGEHA_WORLD_INFO__ && !!document.querySelector('.world-toast__cancel')");
  const point = await evaluate(`(() => {const e=document.querySelector('.world-toast__cancel'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  for (const type of ["mousePressed", "mouseReleased"]) await page.send("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
  await sleep(5000);
  await capture("home-before-samples");
  report.initial = await state();
  check("ready high DPR 1, normal desktop viewport", report.initial.phase === "ready" && report.initial.render.tier === "high" && report.initial.render.dpr === 1 && report.initial.viewport.width === 1440, report.initial);
  for (let i = 0; i < repeats; i++) {
    evidence.stage(`steady-${i + 1}`);
    const result = await evaluate(`new Promise(resolve=>{const intervals=[],renders=[];let start,last;
      const tick=now=>{if(start===undefined){start=now;last=now;}else{intervals.push(now-last);last=now;}
        if(renders.length===0||now-start>=renders.length*1000)renders.push({at:now-start,visibility:document.visibilityState,focus:document.hasFocus(),...window.__AGEHA_WORLD_INFO__()});
        if(now-start>=${duration}){const sorted=[...intervals].sort((a,b)=>a-b);resolve({elapsed:now-start,intervals,renders,avgMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),long33:intervals.filter(n=>n>33.4).length,long50:intervals.filter(n=>n>50).length});}
        else requestAnimationFrame(tick);};requestAnimationFrame(tick);})`);
    report.samples.push(result);
    check(`sample ${i + 1}: visible/focused high DPR 1 throughout`, result.renders.every(r => r.visibility === "visible" && r.focus && r.tier === "high" && r.dpr === 1), result.renders);
    console.log(`sample ${i + 1}: mean=${result.avgMs.toFixed(3)}ms p95=${result.p95Ms.toFixed(3)}ms long50=${result.long50}`);
  }
  evidence.stage("after-samples");
  await capture("home-after-samples");
  const warnings = evidence.events.filter(e => e.method === "Runtime.consoleAPICalled" && e.params.type === "warning");
  report.warnings = Object.entries(Object.groupBy(warnings, e => e.params.args.map(a => a.value ?? a.description ?? a.type).join(" "))).map(([message, events]) => ({ message, count: events.length, stackTrace: events[0].params.stackTrace }));
  if (option("sources", "false") === "true") {
    const scripts = new Map();
    for (const warning of warnings) for (const frame of warning.params.stackTrace?.callFrames ?? []) {
      if (!scripts.has(frame.scriptId)) scripts.set(frame.scriptId, { url: frame.url, frames: [], ...(await page.send("Debugger.getScriptSource", { scriptId: frame.scriptId })) });
      scripts.get(frame.scriptId).frames.push(frame);
    }
    await writeFile(path.join(out, "warning-sources.json"), JSON.stringify([...scripts], null, 2));
  }
  if (option("expect-clean", "false") === "true") check("no redundant geometry conversion or shadow fallback", !warnings.some(e => e.params.args.some(a => /toNonIndexed|PCFSoftShadowMap/.test(a.value ?? ""))));
} catch (error) { report.fatal = error.stack ?? String(error); console.error(report.fatal); process.exitCode = 1; }
finally {
  if (page) page.socket.close();
  if (browser) { if (targetId) await browser.send("Target.closeTarget", { targetId }); browser.socket.close(); }
  report.summary = summarize(evidence.events);
  check("no normal console/runtime/browser/network errors", ["consoleErrors", "exceptions", "browserErrors", "httpErrors", "networkFailures", "canceledRequests"].every(k => report.summary[k] === 0), report.summary);
  report.finishedAt = new Date().toISOString();
  report.checksPassed = report.checks.every(c => c.passed);
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, checksPassed: report.checksPassed, fatal: report.fatal, warnings: report.warnings?.map(w => ({ message: w.message, count: w.count })), summary: report.summary }));
  if (!report.checksPassed) process.exitCode = 1;
}
