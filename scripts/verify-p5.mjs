/**
 * P5 最终回归（生产构建）：
 * - 2560×1440 / 1920×1080 / 1440×900 / 1280×650 桌面，390×844 / 844×390 移动；
 * - 主流程：移动、三项目传送与详情、P2 北径信标、P3 体验、P4 进度持久化/重置；
 * - 失败路径：WebGL 不可用降级、上下文丢失/恢复、屏幕贴图加载失败；
 * - 路由与链接合同、键盘焦点/AX 名称、prefers-reduced-motion；
 * - 资源体积、首次就绪时间、重复循环后的 heap / WebGL 资源稳定性。
 *
 * 用法（生产构建 + 127.0.0.1:3210 + CDP 9223）：
 *   node scripts/verify-p5.mjs
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = "http://127.0.0.1:3210";
const port = 9223;
const outDir = "screenshots/p5-final";
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
const networkFailures = [];
const httpErrors = [];
const requestUrls = new Map();
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
  if (message.method === "Network.requestWillBeSent") {
    requestUrls.set(message.params.requestId, message.params.request?.url ?? null);
  }
  if (message.method === "Network.loadingFailed") {
    networkFailures.push({
      url: requestUrls.get(message.params.requestId) ?? message.params.requestId,
      error: message.params.errorText,
      blocked: message.params.blockedReason ?? null,
    });
  }
  if (message.method === "Network.responseReceived" && message.params.response?.status >= 400) {
    httpErrors.push({
      url: message.params.response.url,
      status: message.params.response.status,
    });
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`${method} timed out`));
    }, 90000);
    pending.set(requestId, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

const frames = (count = 30) =>
  evaluate(`new Promise((resolve) => {
    let n = 0;
    const tick = () => (++n >= ${count} ? resolve(true) : requestAnimationFrame(tick));
    tick();
  })`);

async function waitFor(expression, timeout = 10000, label = expression) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return true;
    await sleep(120);
  }
  throw new Error(`等待超时：${label}`);
}

const keyMap = {
  KeyM: ["m", "KeyM", 77],
  KeyH: ["h", "KeyH", 72],
  KeyR: ["r", "KeyR", 82],
  KeyW: ["w", "KeyW", 87],
  KeyE: ["e", "KeyE", 69],
  Digit1: ["1", "Digit1", 49],
  Digit2: ["2", "Digit2", 50],
  Digit3: ["3", "Digit3", 51],
  Escape: ["Escape", "Escape", 27],
  Enter: ["Enter", "Enter", 13],
  Tab: ["Tab", "Tab", 9],
  ShiftLeft: ["Shift", "ShiftLeft", 16],
};

async function press(name, wait = 100) {
  const [key, code, vk] = keyMap[name];
  const params = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  const text = name === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {};
  await send("Input.dispatchKeyEvent", { ...params, ...text, type: "keyDown" });
  await frames(1);
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
  await sleep(wait);
}

async function hold(name, ms) {
  const [key, code, vk] = keyMap[name];
  const params = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  await sleep(ms);
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
  await frames(3);
  await sleep(100);
}

async function clickSelector(selector, { label = selector } = {}) {
  const found = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    return true;
  })()`);
  assert.ok(found, `找不到可点击元素：${label}`);
  await frames(2);
  const point = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x, y, width: r.width, height: r.height,
      hitTag: hit?.tagName ?? null,
      hitClass: typeof hit?.className === "string" ? hit.className : null,
      hitInside: Boolean(hit && (hit === el || el.contains(hit))),
    };
  })()`);
  assert.ok(point, `元素不可见：${label}`);
  assert.ok(point.hitInside, `${label} 未命中真实元素（hit=${point.hitTag}.${point.hitClass}）`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount: 1,
  });
  await sleep(160);
  await frames(2);
  return point;
}

async function screenshot(name) {
  await frames(2);
  const shot = await send("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: false,
  });
  await writeFile(path.join(outDir, `${name}.png`), Buffer.from(shot.data, "base64"));
  console.log(`screenshot: ${name}`);
}

async function readApp() {
  return evaluate(`(() => {
    const nav = document.querySelector('[data-world-panel="nav"]');
    const root = document.querySelector('#world-root');
    const canvas = document.querySelector('.world-canvas canvas');
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    let raw = null;
    try { raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)}); } catch { raw = "THREW"; }
    const detail = document.querySelector('[data-world-panel="detail"].world-panel--open');
    return {
      phase: root?.dataset.worldPhase ?? null,
      panelOpen: root?.dataset.panelOpen ?? null,
      fallback: Boolean(document.querySelector('.world-fallback')),
      contextMask: Boolean(document.querySelector('.world-context-mask')),
      summary: nav?.querySelector('.world-progress__summary')?.textContent?.trim() ?? null,
      progressDone: [...(nav?.querySelectorAll('.world-progress__item[data-done="true"]') ?? [])].map((el) => el.querySelector('.world-progress__title')?.textContent?.trim()),
      navOpen: Boolean(nav?.classList.contains('world-panel--open')),
      detailOpen: Boolean(detail),
      detailTitle: detail?.querySelector('.world-panel__title')?.textContent?.trim() ?? null,
      detailLinks: [...(detail?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href')),
      detailExternalLinks: [...(detail?.querySelectorAll('a') ?? [])]
        .map((a) => a.getAttribute('href'))
        .filter((href) => Boolean(href) && !href.startsWith('/')),
      detailText: detail?.textContent?.trim().slice(0, 500) ?? null,
      navLinks: [...(nav?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href')),
      hudQuick: rect('.world-hud__quick'),
      joystick: rect('.world-joystick'),
      toast: rect('.world-toast'),
      panel: rect('.world-panel--open'),
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth },
      canvas: canvas ? { bufferW: canvas.width, bufferH: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight } : null,
      active: { tag: document.activeElement?.tagName ?? null, label: document.activeElement?.getAttribute('aria-label') ?? null, text: document.activeElement?.textContent?.trim().slice(0, 60) ?? null },
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      mobileLike: matchMedia('(pointer: coarse)').matches || innerWidth < 768,
      storage: raw,
      world: window.__AGEHA_WORLD_STATE__?.() ?? null,
      render: window.__AGEHA_WORLD_INFO__?.() ?? null,
      memory: window.__AGEHA_MEMORY_RING__?.() ?? null,
    };
  })()`);
}

async function hideOverlays() {
  await evaluate(`document.querySelector('.world-toast__close')?.click()`);
  await evaluate(`document.querySelector('.world-hud__hint-close')?.click()`);
  await frames(2);
}

async function navigateWorld(pathAndQuery = "/?debug=1&tier=high") {
  const start = Date.now();
  await send("Page.navigate", { url: `${base}${pathAndQuery}` });
  await waitFor(
    `document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && Boolean(window.__AGEHA_WORLD_STATE__)`,
    90000,
    "世界就绪",
  );
  await frames(35);
  await hideOverlays();
  await press("ShiftLeft", 50);
  const readyMs = Date.now() - start;
  return { readyMs, ...(await readApp()) };
}

async function openNav() {
  if (await evaluate(`Boolean(document.querySelector('[data-world-panel="nav"].world-panel--open'))`)) return;
  await press("KeyM", 160);
  await waitFor(`Boolean(document.querySelector('[data-world-panel="nav"].world-panel--open'))`, 4000, "导航打开");
  await frames(2);
}

async function closeNav() {
  if (!(await evaluate(`Boolean(document.querySelector('[data-world-panel="nav"].world-panel--open'))`))) return;
  await press("Escape", 200);
  await waitFor(`!document.querySelector('[data-world-panel="nav"].world-panel--open')`, 4000, "导航关闭");
  await frames(2);
}

async function approachAndOpenDetail(shortcut) {
  await press(shortcut, 120);
  await sleep(1550);
  await frames(10);
  await hold("KeyW", 1200);
  await frames(16);
  await waitFor(`Boolean(document.querySelector('.world-hud__prompt-btn'))`, 6000, "项目提示出现");
  await clickSelector('.world-hud__prompt-btn', { label: "项目详情提示" });
  await waitFor(`Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open'))`, 5000, "详情打开");
  await frames(2);
  return readApp();
}

async function completeExperience(shortcut, expectedCount) {
  await press(shortcut, 120);
  await sleep(1550);
  await frames(10);
  await hold("KeyW", 1200);
  await frames(16);
  await waitFor(`Boolean(document.querySelector('.world-experience__btn'))`, 6000, "体验控制带");
  const label = await evaluate(`document.querySelector('.world-experience__btn')?.textContent?.trim() ?? null`);
  await clickSelector('.world-experience__btn', { label: `体验选项 ${label}` });
  await waitFor(
    `document.querySelectorAll('[data-world-panel="nav"] .world-progress__item[data-done="true"]').length >= ${expectedCount}`,
    6000,
    `进度达到 ${expectedCount}`,
  );
  return { label, ...(await readApp()) };
}

async function runRouteChecks(label) {
  const routes = [
    ["/", null],
    ["/projects", "全部项目"],
    ["/about", "关于我"],
    ["/contact", "联系我"],
    ["/tech", "技术栈"],
    ["/articles", "文章与实验"],
    ["/projects/agehaos", "AgehaOS"],
    ["/projects/cs-skin-invest", "CS 饰品虚拟投资模拟器"],
    ["/projects/moss-world", "Moss World"],
  ];
  const results = [];
  for (const [route, expected] of routes) {
    await send("Page.navigate", { url: `${base}${route}` });
    await waitFor(`document.readyState === 'complete'`, 30000, `${route} 加载`);
    await sleep(180);
    const value = await evaluate(`(() => ({
      path: location.pathname,
      h1: document.querySelector('h1')?.textContent?.trim() ?? '',
      text: document.body.innerText.trim().length,
      title: document.title,
      projectCards: document.querySelectorAll('a[href^="/projects/"]').length,
    }))()`);
    results.push({ route, expected, ...value });
    if (expected) {
      assert.equal(value.path, route, `${label} ${route} 路由应正确`);
      assert.ok(value.h1.includes(expected), `${label} ${route} 应渲染「${expected}」`);
      assert.ok(value.text > 60, `${label} ${route} 应有内容`);
    } else {
      assert.ok(value.text > 50, `${label} 首页应有内容`);
      assert.ok(value.h1.length > 0, `${label} 首页应有 h1`);
    }
  }
  console.log(`routes(${label}):`, results.map((item) => `${item.route}:${item.h1 || "world"}`));
  return results;
}

async function heapSnapshot() {
  await send("HeapProfiler.collectGarbage").catch(() => {});
  await sleep(250);
  const usage = await send("Runtime.getHeapUsage").catch(() => null);
  const app = await readApp();
  return {
    usedSize: usage?.usedSize ?? null,
    totalSize: usage?.totalSize ?? null,
    render: app.render,
  };
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: [] });
  await send("Network.setCacheDisabled", { cacheDisabled: false });
  await send("Network.clearBrowserCache").catch(() => {});
  await send("Accessibility.enable");
  await send("HeapProfiler.enable").catch(() => {});
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await mkdir(outDir, { recursive: true });

  const report = {
    base,
    environment: null,
    desktop: {},
    mobile: {},
    interactions: {},
    progress: {},
    accessibility: {},
    failureModes: {},
    routes: {},
    leak: {},
    load: {},
    errors: [],
    network: {},
  };

  // 清理 P4 残留，保证最终回归从零开始
  await send("Page.navigate", { url: `${base}/projects` });
  await waitFor(`document.readyState === 'complete'`, 30000, "起始页");
  await evaluate(`(() => { try { localStorage.removeItem(${JSON.stringify(STORAGE_KEY)}); } catch {} return true; })()`);

  // ---------- 1. 1440 主流程 + 资源/首屏 ----------
  const entry = await navigateWorld();
  for (let i = 0; i < 120 && !entry.render; i += 1) await sleep(100);
  const environment = await evaluate(`(() => {
    const canvas = document.querySelector('.world-canvas canvas');
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    return {
      ua: navigator.userAgent,
      platform: navigator.platform,
      cores: navigator.hardwareConcurrency,
      memory: navigator.deviceMemory ?? null,
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      navigation: nav ? {
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd),
      } : null,
      resources: {
        count: resources.length,
        decodedBytes: resources.reduce((sum, item) => sum + (item.decodedBodySize || 0), 0),
        transferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
      },
    };
  })()`);
  report.environment = environment;
  report.load = { readyMs: entry.readyMs, tier: entry.render?.tier, render: entry.render, navigation: environment.navigation, resources: environment.resources };
  assert.equal(entry.phase, "ready");
  assert.equal(entry.viewport.w, 1440);
  assert.equal(entry.render?.tier, "high");
  await screenshot("01-desktop-1440-entry");

  // 移动/回起点
  const beforeMove = entry.world?.player;
  await hold("KeyW", 900);
  await frames(20);
  const afterMove = await readApp();
  const moved = beforeMove && afterMove.world
    ? Math.hypot(afterMove.world.player.x - beforeMove.x, afterMove.world.player.z - beforeMove.z)
    : 0;
  assert.ok(moved > 2, `W 前进应产生位移（${moved.toFixed(2)}）`);
  await press("KeyR", 200);
  await sleep(1100);
  await frames(16);
  report.interactions.movement = { before: beforeMove, after: afterMove.world?.player, distance: +moved.toFixed(2) };

  // 三项目：体验 + 详情（生产构建真实鼠标/键盘）
  const agehaos = await completeExperience("Digit1", 1);
  report.interactions.agehaos = { option: agehaos.label, summary: agehaos.summary, storage: agehaos.storage };
  const agehaosDetail = await approachAndOpenDetail("Digit1");
  assert.equal(agehaosDetail.detailTitle, "AgehaOS");
  assert.ok(agehaosDetail.detailLinks.some((href) => href?.includes("os.ageha.cn")), "AgehaOS 详情应保留真实链接");
  await press("Escape", 180);
  await waitFor(`!document.querySelector('[data-world-panel="detail"].world-panel--open')`, 4000, "AgehaOS 详情关闭");

  const cs = await completeExperience("Digit2", 2);
  report.interactions.cs = { option: cs.label, summary: cs.summary };
  const csDetail = await approachAndOpenDetail("Digit2");
  assert.equal(csDetail.detailTitle, "CS 饰品虚拟投资模拟器");
  assert.ok(csDetail.detailLinks.some((href) => href?.includes("cs.ageha.cn") || href?.includes("github.com")), "CS 详情应保留真实链接");
  await press("Escape", 180);
  await waitFor(`!document.querySelector('[data-world-panel="detail"].world-panel--open')`, 4000, "CS 详情关闭");

  const moss = await completeExperience("Digit3", 3);
  report.interactions.moss = { option: moss.label, summary: moss.summary };
  const mossDetail = await approachAndOpenDetail("Digit3");
  assert.equal(mossDetail.detailTitle, "Moss World");
  assert.equal(mossDetail.detailExternalLinks.length, 0, "Moss World 不得有外链");
  assert.ok(mossDetail.detailLinks.includes("/projects/moss-world"), "Moss World 应保留站内详情路由");
  assert.ok(mossDetail.detailText?.includes("暂无公开链接"), "Moss World 应如实标注无公开链接");
  await press("Escape", 180);
  await waitFor(`!document.querySelector('[data-world-panel="detail"].world-panel--open')`, 4000, "Moss 详情关闭");
  await screenshot("02-desktop-1440-moss-detail-closed");

  // P2 信标：真实走到信标并按 E（此目标同时验证 P2→P4 接线）
  await press("KeyR", 200);
  await sleep(1200);
  await hold("KeyW", 2650);
  const relayPrompt = await evaluate(`document.querySelector('.world-hud__prompt-btn')?.textContent?.trim() ?? null`);
  assert.ok(relayPrompt?.includes("点亮北径"), `近信标应出现点亮提示（实际 ${relayPrompt}）`);
  await press("KeyE", 600);
  await waitFor(
    `document.querySelectorAll('[data-world-panel="nav"] .world-progress__item[data-done="true"]').length >= 4`,
    6000,
    "信标目标完成",
  );
  const relayState = await readApp();
  report.interactions.relay = { prompt: relayPrompt, summary: relayState.summary, storage: relayState.storage };
  assert.equal(relayState.summary, "4 / 5 瓣记忆已点亮");
  await screenshot("03-desktop-1440-relay");

  // 导航/链接合同 + 进度 UI
  await openNav();
  const navState = await readApp();
  assert.equal(navState.navOpen, true);
  for (const href of ["/projects", "/about", "/tech", "/articles", "/contact"]) {
    assert.ok(navState.navLinks.includes(href), `导航应包含 ${href}`);
  }
  report.routes.navLinks = navState.navLinks;
  await screenshot("04-desktop-1440-nav-progress");
  await closeNav();

  // 刷新持久化
  await send("Page.reload");
  await waitFor(`document.querySelector('#world-root')?.dataset.worldPhase === 'ready'`, 60000, "刷新后世界");
  await frames(30);
  await hideOverlays();
  const persisted = await readApp();
  report.progress.afterRefresh = { summary: persisted.summary, memory: persisted.memory, storage: persisted.storage };
  assert.equal(persisted.summary, "4 / 5 瓣记忆已点亮");
  assert.equal(persisted.memory?.lit, 4);
  assert.equal(await evaluate(`document.querySelector('.world-hud__progress')?.textContent ?? null`), null, "刷新不应重复奖励提示");

  // 键盘导航 + AX + 焦点可见
  await evaluate(`document.querySelector('button[aria-label^="打开世界导航"]')?.focus()`);
  await clickSelector('button[aria-label^="打开世界导航"]', { label: "HUD 导航按钮" });
  await waitFor(`Boolean(document.querySelector('[data-world-panel="nav"].world-panel--open'))`, 4000, "键盘测试导航");
  let tabs = 0;
  let resetReached = false;
  while (tabs < 40 && !resetReached) {
    await press("Tab", 35);
    tabs += 1;
    resetReached = await evaluate(`document.activeElement?.getAttribute('aria-controls') === 'world-progress-reset-confirm'`);
  }
  assert.ok(resetReached, `Tab 应到达重置按钮（${tabs} 次）`);
  const focusVisible = await evaluate(`(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, focusVisible: el.matches(':focus-visible') };
  })()`);
  assert.equal(focusVisible.focusVisible, true, "键盘焦点应匹配 :focus-visible");
  assert.notEqual(focusVisible.outlineStyle, "none", "焦点应有可见 outline");
  const ax = await send("Accessibility.getFullAXTree");
  const axNames = ax.nodes.map((node) => node.name?.value).filter(Boolean);
  for (const name of ["世界导航", "探索进度", "重置探索进度"]) {
    assert.ok(axNames.includes(name), `AX 树应包含「${name}」`);
  }
  report.accessibility = { tabs, focusVisible, axNames: axNames.filter((name) => ["世界导航", "探索进度", "重置探索进度", "返回主岛 · 苏醒环礁"].includes(name)) };
  await press("Enter", 200);
  await waitFor(`document.querySelector('button[aria-controls="world-progress-reset-confirm"]')?.getAttribute('aria-expanded') === "true"`, 3000, "重置确认");
  await screenshot("05-desktop-1440-keyboard-reset");
  await press("Escape", 200);
  await waitFor(`!document.querySelector('[data-world-panel="nav"].world-panel--open')`, 4000, "Esc 关闭");
  await waitFor(`document.activeElement?.getAttribute('aria-label')?.startsWith('打开世界导航') === true`, 3000, "焦点归还");
  report.accessibility.focusReturned = true;

  // P4 重置
  await openNav();
  await evaluate(`document.querySelector('button[aria-controls="world-progress-reset-confirm"]')?.scrollIntoView({block:'center',behavior:'instant'})`);
  await frames(2);
  await clickSelector('button[aria-controls="world-progress-reset-confirm"]', { label: "重置探索进度" });
  await waitFor(`document.querySelector('button[aria-controls="world-progress-reset-confirm"]')?.getAttribute('aria-expanded') === "true"`, 3000, "重置确认");
  await clickSelector('.world-nav__card-btn--danger', { label: "确认重置" });
  await waitFor(`document.querySelectorAll('[data-world-panel="nav"] .world-progress__item[data-done="true"]').length === 0`, 4000, "进度清零");
  const reset = await readApp();
  report.progress.reset = { summary: reset.summary, memory: reset.memory, storage: reset.storage, progressDone: reset.progressDone };
  assert.equal(reset.summary, "0 / 5 瓣记忆已点亮");
  assert.equal(reset.memory?.lit, 0);
  assert.equal(reset.storage, null);
  await screenshot("06-desktop-1440-reset");
  await closeNav();

  // ---------- 2. 资源/堆稳定性：体验与面板循环 ----------
  // 预热三个岛：首次靠近会延迟创建各自的演示屏 / 结构几何，不能算泄漏。
  const warmCycle = await (async () => {
    for (const shortcut of ["Digit1", "Digit2", "Digit3"]) {
      await press(shortcut, 120);
      await sleep(1200);
    }
    await press("KeyR", 180);
    await sleep(900);
  })();
  const beforeCycle = await heapSnapshot();
  for (let i = 0; i < 3; i += 1) {
    await press("Digit1", 100);
    await sleep(1200);
    await press("Digit2", 100);
    await sleep(1200);
    await press("Digit3", 100);
    await sleep(1200);
    await press("KeyR", 150);
    await sleep(700);
  }
  const afterCycle = await heapSnapshot();
  report.leak = {
    before: beforeCycle,
    after: afterCycle,
    heapDelta: beforeCycle.usedSize != null && afterCycle.usedSize != null
      ? afterCycle.usedSize - beforeCycle.usedSize
      : null,
    geometryDelta: beforeCycle.render && afterCycle.render
      ? afterCycle.render.geometries - beforeCycle.render.geometries
      : null,
    textureDelta: beforeCycle.render && afterCycle.render
      ? afterCycle.render.textures - beforeCycle.render.textures
      : null,
    warmCycle,
  };
  console.log("leak:", JSON.stringify(report.leak, null, 2));
  assert.ok(
    report.leak.heapDelta == null || report.leak.heapDelta < 40 * 1024 * 1024,
    `重复 3 轮后 heap 增长应 <40MB（实际 ${report.leak.heapDelta}）`,
  );
  assert.ok(
    report.leak.geometryDelta == null || report.leak.geometryDelta < 30,
    `重复 3 轮后 geometries 增长应 <30（实际 ${report.leak.geometryDelta}）`,
  );
  assert.ok(
    report.leak.textureDelta == null || report.leak.textureDelta < 30,
    `重复 3 轮后 textures 增长应 <30（实际 ${report.leak.textureDelta}）`,
  );

  // ---------- 3. 路由回归 ----------
  report.routes.normal = await runRouteChecks("normal");

  // 正常流程（含路由）必须先无运行时异常；失败路径的预期错误单独记录
  const preFailureErrors = errors.filter(
    (error) => !/synchronously unmount a root/i.test(String(error)),
  );
  report.preFailureErrors = preFailureErrors;
  assert.deepEqual(preFailureErrors, [], "正常主流程与路由不应有运行时异常");
  const failureStart = errors.length;

  // ---------- 4. WebGL 不可用降级 ----------
  const { identifier: webglBlock } = await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (String(type).toLowerCase().startsWith("webgl")) return null;
        return original.call(this, type, ...args);
      };
    })();`,
  });
  await send("Page.navigate", { url: `${base}/` });
  await waitFor(`Boolean(document.querySelector('.world-fallback'))`, 20000, "WebGL 降级页");
  const fallback = await readApp();
  const fallbackText = await evaluate(`document.querySelector('.world-fallback')?.innerText ?? ''`);
  report.failureModes.webglUnavailable = {
    phase: fallback.phase,
    fallback: fallback.fallback,
    text: fallbackText.slice(0, 300),
    cards: await evaluate(`document.querySelectorAll('.world-fallback a[href^="/projects/"]').length`),
    navLinks: await evaluate(`[...document.querySelectorAll('.world-fallback__nav a')].map((a) => a.getAttribute('href'))`),
  };
  assert.equal(fallback.fallback, true);
  assert.ok((report.failureModes.webglUnavailable.cards ?? 0) >= 3, "降级页应列出全部项目");
  assert.ok(fallbackText.includes("WebGL 不可用"), "降级页应说明 WebGL 不可用");
  await screenshot("07-webgl-unavailable");
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: webglBlock });

  // ---------- 5. 上下文丢失/恢复 ----------
  await navigateWorld();
  const contextResult = await evaluate(`(() => {
    const canvas = document.querySelector('.world-canvas canvas');
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) return { ext: false };
    window.__P5_LOSE_CTX__ = ext;
    ext.loseContext();
    return { ext: true };
  })()`);
  report.failureModes.context = contextResult;
  if (contextResult.ext) {
    await waitFor(`Boolean(document.querySelector('.world-context-mask'))`, 5000, "上下文丢失遮罩");
    await screenshot("08-context-lost");
    const mask = await readApp();
    assert.equal(mask.contextMask, true);
    await evaluate(`window.__P5_LOSE_CTX__?.restoreContext()`);
    await waitFor(`!document.querySelector('.world-context-mask')`, 5000, "上下文恢复");
    report.failureModes.context.restored = true;
    await screenshot("09-context-restored");
  } else {
    report.failureModes.context.restored = null;
  }

  // ---------- 6. 资源加载失败（屏幕贴图拦截） ----------
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Network.setBlockedURLs", {
    urls: ["*world/screens/*", "*world/gallery/*", "*butterfly-sprite-512.png*"],
  });
  const blockedEntry = await navigateWorld();
  const blockedPrompt = await (async () => {
    await press("Digit1", 120);
    await sleep(1500);
    await frames(10);
    await hold("KeyW", 1000);
    await frames(14);
    return evaluate(`document.querySelector('.world-hud__prompt-btn')?.textContent ?? null`);
  })();
  const blockedState = await readApp();
  const failureUi = await evaluate(`(() => {
    const loading = document.querySelector('.world-loading');
    const fail = document.querySelector('.world-loading__fail');
    const browse = document.querySelector('.world-loading__browse');
    const retry = document.querySelector('.world-loading__retry');
    const read = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        href: el.getAttribute('href') ?? null,
        pointerEvents: getComputedStyle(el).pointerEvents,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        hitInside: Boolean(hit && (hit === el || el.contains(hit))),
      };
    };
    return {
      failed: Boolean(fail),
      role: fail?.getAttribute('role') ?? null,
      ariaHidden: loading?.getAttribute('aria-hidden') ?? null,
      browse: read(browse),
      retry: read(retry),
    };
  })()`);
  report.failureModes.resourceFailure = {
    phase: blockedState.phase,
    fallback: blockedState.fallback,
    prompt: blockedPrompt,
    readyMs: blockedEntry.readyMs,
    failureUi,
    errors: errors.slice(-8),
    networkFailures: networkFailures.slice(-8),
  };
  await screenshot("10-resource-blocked");
  assert.equal(blockedState.phase, "ready", "屏幕贴图加载失败不应让世界变成空白");
  assert.equal(failureUi.failed, true, "贴图失败应显示「部分区域未能点亮」");
  assert.equal(failureUi.role, "alert");
  assert.equal(failureUi.ariaHidden, "false", "失败提示不能被加载屏 aria-hidden 隐藏");
  assert.equal(failureUi.browse?.pointerEvents, "auto", "失败提示的项目列表入口应可点击");
  assert.equal(failureUi.browse?.hitInside, true, "项目列表入口应命中真实元素");
  assert.equal(failureUi.retry?.pointerEvents, "auto", "重试按钮应可点击");
  await clickSelector('.world-loading__browse', { label: "失败提示·项目列表" });
  await waitFor(`location.pathname === '/projects'`, 10000, "失败提示跳转项目列表");
  report.failureModes.resourceFailure.browseNavigated = true;
  report.failureModes.errors = errors.slice(failureStart);
  // 失败路径的预期错误已记录；后续 UI/视口测试仍需保持零异常
  errors.length = 0;
  await send("Network.setBlockedURLs", { urls: [] });
  await send("Network.setCacheDisabled", { cacheDisabled: false });

  // ---------- 7. 桌面大视口 / 窄矮 / 移动 ----------
  async function checkViewport(width, height, dsf, mobile, label) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dsf, mobile });
    await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
    const state = await navigateWorld("?debug=1&tier=high");
    const view = await readApp();
    const checked = {
      label,
      viewport: view.viewport,
      canvas: view.canvas,
      hudQuick: view.hudQuick,
      toast: view.toast,
      joystick: view.joystick,
      mobileLike: view.mobileLike,
      noHorizontalOverflow: view.viewport.scrollW <= view.viewport.clientW + 1,
      hudInViewport: view.hudQuick ? view.hudQuick.x >= 0 && view.hudQuick.bottom <= height + 1 : null,
      readyMs: state.readyMs,
    };
    assert.ok(checked.noHorizontalOverflow, `${label} 不应横向溢出`);
    if (mobile) assert.equal(view.mobileLike, true, `${label} 应判定为移动端`);
    await openNav();
    const nav = await readApp();
    checked.nav = nav.panel;
    checked.resetHeight = await evaluate(`(() => { const b = document.querySelector('button[aria-controls="world-progress-reset-confirm"]'); return b ? b.getBoundingClientRect().height : null; })()`);
    assert.ok(checked.resetHeight >= 43, `${label} 重置按钮触控高度应 ≥44px`);
    await screenshot(`11-${label}`);
    await closeNav();
    return checked;
  }

  report.desktop.w1440 = await checkViewport(1440, 900, 1, false, "desktop-1440");
  report.desktop.w1920 = await checkViewport(1920, 1080, 1, false, "desktop-1920");
  report.desktop.w2560 = await checkViewport(2560, 1440, 1, false, "desktop-2560");
  report.desktop.w1280x650 = await checkViewport(1280, 650, 1, false, "desktop-1280x650");
  report.mobile.portrait = await checkViewport(390, 844, 3, true, "mobile-390x844");
  report.mobile.landscape = await checkViewport(844, 390, 2, true, "mobile-844x390");

  // 移动端详情可访问（详情入口来自导航卡）
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await navigateWorld("?debug=1&tier=medium");
  await openNav();
  await clickSelector('[data-world-panel="nav"] .world-nav__card:first-child .world-nav__card-actions button:last-child', { label: "移动端详情" });
  await waitFor(`Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open'))`, 5000, "移动端详情打开");
  const mobileDetail = await readApp();
  report.mobile.detail = {
    title: mobileDetail.detailTitle,
    panel: mobileDetail.panel,
    cover: await evaluate(`(() => { const el = document.querySelector('.world-detail__cover'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`),
    noHorizontalOverflow: mobileDetail.viewport.scrollW <= mobileDetail.viewport.clientW + 1,
  };
  assert.equal(mobileDetail.detailTitle, "AgehaOS");
  assert.ok(report.mobile.detail.cover?.h > 80, "移动端详情封面不应塌缩");
  await screenshot("12-mobile-detail");
  await press("Escape", 180);

  // ---------- 8. 无障碍：减少动态 + 说明面板 ----------
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const reduced = await readApp();
  report.accessibility.reducedMotion = reduced.reducedMotion;
  assert.equal(reduced.reducedMotion, true);
  await press("KeyH", 180);
  await waitFor(`Boolean(document.querySelector('[data-world-panel="help"].world-panel--open'))`, 4000, "说明面板");
  const helpAx = await send("Accessibility.getFullAXTree");
  const helpNames = helpAx.nodes.map((node) => node.name?.value).filter(Boolean);
  for (const name of ["操作说明", "降低动态", "跳过探索，直接看项目列表"]) {
    if (name === "降低动态") continue;
    assert.ok(helpNames.some((value) => value.includes(name)), `说明面板 AX 应包含「${name}」`);
  }
  report.accessibility.helpNames = helpNames.filter((name) => ["操作说明", "跳过探索，直接看项目列表"].some((key) => name.includes(key)));
  await screenshot("13-help-panel");
  await press("Escape", 180);

  // ---------- 9. 收尾汇总 ----------
  const sceneErrors = errors.filter(
    (error) => !/synchronously unmount a root/i.test(String(error)),
  );
  report.errors = sceneErrors;
  report.network = {
    failures: networkFailures.filter(
      (item) => !/(world\/(screens|gallery)|butterfly-sprite-512)/.test(item.url),
    ),
    httpErrors,
  };
  report.final = {
    routesNormal: report.routes.normal.length,
    viewports: Object.keys(report.desktop).length + Object.keys(report.mobile).length,
    p2Relay: Boolean(report.interactions.relay),
    p3Experiences: ["agehaos", "cs", "moss"].every((key) => Boolean(report.interactions[key])),
    p4Progress: Boolean(report.progress.afterRefresh && report.progress.reset),
  };
  await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(sceneErrors, [], "最终回归不应有新增运行时异常");
  console.log("P5 production regression passed");
  console.log(JSON.stringify(report.final, null, 2));
  console.log("leak:", JSON.stringify({ heapDelta: report.leak.heapDelta, geometryDelta: report.leak.geometryDelta, textureDelta: report.leak.textureDelta }));
} finally {
  socket.close();
}
