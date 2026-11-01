/**
 * P4 探索进度真实验收（Chrome DevTools Protocol）。
 *
 * 覆盖：首访完成多个项目体验 → 刷新保留 → 复访不重复奖励 → 重置与再次触发；
 * 存储不可用 / 写入失败回退；桌面 / 窄矮 / 移动横竖屏 / 文字放大 / 低画质 /
 * prefers-reduced-motion；进度 UI 键盘焦点与可访问名称；路由可达性。
 *
 * 用法（先启动 dev server 与带 --remote-debugging-port=9222 的独立 Chrome）：
 *   node scripts/verify-p4.mjs
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const option = (key, fallback) =>
  args.includes(`--${key}`) ? args[args.indexOf(`--${key}`) + 1] : fallback;
const base = option("url", "http://127.0.0.1:3002");
const port = Number(option("port", 9222));
const outDir = option("outDir", "screenshots/p4-final");
const STORAGE_KEY = "ageha.world.exploration";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target =
  targets.find((item) => item.type === "page" && item.url.includes("127.0.0.1")) ??
  targets.find((item) => item.type === "page");
assert.ok(target, "请先启动带 --remote-debugging-port=9222 的独立 Chrome");

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
  if (message.method === "Runtime.executionContextsCleared") errors.length = 0;
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    errors.push(
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text ??
        "exception",
    );
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
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
  Digit1: ["1", "Digit1", 49],
  Digit2: ["2", "Digit2", 50],
  Digit3: ["3", "Digit3", 51],
  Escape: ["Escape", "Escape", 27],
  Enter: ["Enter", "Enter", 13],
  Tab: ["Tab", "Tab", 9],
  ShiftLeft: ["Shift", "ShiftLeft", 16],
};

async function press(name, wait = 90) {
  const [key, code, vk] = keyMap[name];
  const params = {
    key,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
  };
  // Enter 需要生成字符事件，浏览器才会执行按钮的默认激活
  const text = name === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {};
  await send("Input.dispatchKeyEvent", { ...params, ...text, type: "keyDown" });
  await frames(1);
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
  await sleep(wait);
}

async function hold(name, ms) {
  const [key, code, vk] = keyMap[name];
  const params = {
    key,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
  };
  await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  await sleep(ms);
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
  await frames(3);
  await sleep(80);
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
      x, y,
      width: r.width, height: r.height,
      hitTag: hit?.tagName ?? null,
      hitClass: typeof hit?.className === "string" ? hit.className : null,
      hitInside: Boolean(hit && (hit === el || el.contains(hit))),
    };
  })()`);
  assert.ok(point, `元素不可见：${label}`);
  assert.ok(
    point.hitInside,
    `${label} 未命中真实元素（hit=${point.hitTag}.${point.hitClass}，可能是 pointer-events 问题）`,
  );
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await sleep(140);
  await frames(2);
  return point;
}

async function screenshot(name) {
  await frames(2);
  const result = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const file = path.join(outDir, `${name}.png`);
  await writeFile(file, Buffer.from(result.data, "base64"));
  console.log(`screenshot: ${file}`);
}

async function readUI() {
  return evaluate(`(() => {
    const nav = document.querySelector('[data-world-panel="nav"]');
    const items = [...(nav?.querySelectorAll('.world-progress__item') ?? [])].map((el) => ({
      done: el.dataset.done,
      title: el.querySelector('.world-progress__title')?.textContent?.trim() ?? '',
      state: el.querySelector('.world-progress__state')?.textContent?.trim() ?? '',
    }));
    const resetButton = nav?.querySelector('button[aria-controls="world-progress-reset-confirm"]');
    const panel = document.querySelector('.world-panel--open');
    let storageRaw = 'BLOCKED';
    try { storageRaw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)}); } catch { storageRaw = 'THREW'; }
    const active = document.activeElement;
    return {
      phase: document.querySelector('#world-root')?.dataset.worldPhase ?? null,
      summary: nav?.querySelector('.world-progress__summary')?.textContent?.trim() ?? null,
      items,
      note: nav?.querySelector('.world-progress__note')?.textContent?.trim() ?? null,
      warning: nav?.querySelector('.world-progress__warning')?.textContent?.trim() ?? null,
      resetExpanded: resetButton?.getAttribute('aria-expanded') ?? null,
      resetRect: resetButton ? (() => {
        const r = resetButton.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })() : null,
      activePanel: panel?.getAttribute('data-world-panel') ?? null,
      detailTitle: document.querySelector('[data-world-panel="detail"].world-panel--open .world-panel__title')?.textContent?.trim() ?? null,
      detailLinks: [...document.querySelectorAll('[data-world-panel="detail"].world-panel--open a')].map((a) => a.getAttribute('href')),
      activeElement: {
        tag: active?.tagName ?? null,
        text: active?.textContent?.trim().slice(0, 80) ?? null,
        label: active?.getAttribute?.('aria-label') ?? null,
      },
      notice: document.querySelector('.world-hud__progress')?.textContent?.trim() ?? null,
      memory: window.__AGEHA_MEMORY_RING__?.() ?? null,
      isle: window.__AGEHA_ISLE_EXPERIENCE__
        ? Object.fromEntries(Object.entries(window.__AGEHA_ISLE_EXPERIENCE__).map(([key, fn]) => [key, fn()]))
        : null,
      storageRaw,
      nookButton: [...(nav?.querySelectorAll('button') ?? [])].some((b) => b.textContent.includes('茧居所')),
      viewport: {
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      layout: {
        root: (() => { const el = document.querySelector('#world-root'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
        canvas: (() => { const el = document.querySelector('.world-canvas'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
        hud: (() => { const el = document.querySelector('.world-hud'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
      },
      panel: panel ? (() => {
        const r = panel.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, scrollHeight: panel.scrollHeight };
      })() : null,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      mobileLike: matchMedia('(pointer: coarse)').matches || innerWidth < 768,
      tier: window.__AGEHA_WORLD_INFO__?.().tier ?? null,
      promptVisible: Boolean(document.querySelector('.world-experience__btn')),
      routeLinks: [...(nav?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href')),
    };
  })()`);
}

function completedIds(ui) {
  return ui.items.filter((item) => item.done === "true").map((item) => item.title);
}

function parseStored(raw) {
  if (!raw || raw === "THREW" || raw === "BLOCKED") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function hideDevBadge() {
  await evaluate(`(() => {
    if (document.getElementById('p4-hide-dev')) return;
    const style = document.createElement('style');
    style.id = 'p4-hide-dev';
    style.textContent = 'nextjs-portal{display:none!important}';
    document.head.appendChild(style);
  })()`);
}

async function dismissOverlays() {
  await evaluate(`document.querySelector('.world-toast__close')?.click()`);
  await evaluate(`document.querySelector('.world-hud__hint-close')?.click()`);
  await frames(2);
}

async function navigateWorld(query = "?debug=1&tier=high") {
  await send("Page.navigate", { url: `${base}/${query}` });
  await waitFor(
    `document.querySelector('#world-root')?.dataset.worldPhase === 'ready' && Boolean(window.__AGEHA_WORLD_INFO__)`,
    90000,
    "世界就绪",
  );
  await frames(45);
  await dismissOverlays();
  await hideDevBadge();
  await press("ShiftLeft", 50);
  // 首次按键用于页面聚焦；再等一帧，后续快捷键才稳定生效
  await frames(2);
}

async function openNav() {
  if (await evaluate(`Boolean(document.querySelector('[data-world-panel="nav"].world-panel--open'))`)) return;
  await press("KeyM", 150);
  await waitFor(
    `Boolean(document.querySelector('[data-world-panel="nav"].world-panel--open'))`,
    4000,
    "导航面板打开",
  );
  await frames(2);
}

async function closeNav() {
  if (!(await evaluate(`Boolean(document.querySelector('[data-world-panel="nav"].world-panel--open'))`))) return;
  await press("Escape", 180);
  await waitFor(
    `!document.querySelector('[data-world-panel="nav"].world-panel--open')`,
    4000,
    "导航面板关闭",
  );
  await frames(2);
}

async function scrollProgressIntoView() {
  // 只滚动面板正文；scrollIntoView 可能连带滚动 fixed 的 #world-root，
  // 在移动端会把整个面板推离视口（usePanelA11y 的同一历史问题）。
  await evaluate(`(() => {
    const heading = document.querySelector('#world-progress-title');
    const body = heading?.closest('.world-panel__body');
    if (heading && body) {
      const delta = heading.getBoundingClientRect().top - body.getBoundingClientRect().top;
      body.scrollTop += delta - 6;
    }
    const root = document.querySelector('#world-root');
    if (root) {
      root.scrollTop = 0;
      root.scrollLeft = 0;
    }
    return true;
  })()`);
  await frames(2);
}

async function returnToSpawnAndSettle() {
  await press("KeyR", 200);
  await waitFor(
    `(() => {
      const s = window.__AGEHA_WORLD_STATE__?.();
      return Boolean(s && Math.hypot(s.player.x - 6.5, s.player.z - 7) < 0.8);
    })()`,
    8000,
    "返回出生点",
  );
  await sleep(1200);
  await frames(20);
}

async function approachProject(shortcut, expectedTitle) {
  await press(shortcut, 120);
  await sleep(1550);
  await frames(15);
  await hold("KeyW", 1200);
  await frames(20);
  if (!(await evaluate(`Boolean(document.querySelector('.world-experience__btn'))`))) {
    await hold("KeyW", 550);
    await frames(12);
  }
  await waitFor(
    `Boolean(document.querySelector('.world-experience__btn'))`,
    6000,
    `${expectedTitle} 体验控制带出现`,
  );
  const stripLabel = await evaluate(
    `document.querySelector('.world-experience')?.getAttribute('aria-label') ?? null`,
  );
  assert.ok(
    stripLabel?.includes(expectedTitle),
    `体验控制带应为 ${expectedTitle}（实际 ${stripLabel}）`,
  );
}

async function completeExperience(shortcut, expectedTitle, expectedCount) {
  await approachProject(shortcut, expectedTitle);
  const point = await clickSelector('.world-experience__btn', { label: `${expectedTitle} 首个选项` });
  await waitFor(
    `document.querySelectorAll('[data-world-panel="nav"] .world-progress__item[data-done="true"]').length >= ${expectedCount}`,
    5000,
    `进度达到 ${expectedCount}/5`,
  );
  await frames(4);
  const ui = await readUI();
  return { point, ui };
}

async function runRouteChecks(stage) {
  const routes = [
    ["/projects", "全部项目"],
    ["/about", "关于我"],
    ["/contact", "联系我"],
    ["/tech", "技术"],
    ["/articles", "文章"],
    ["/projects/agehaos", "AgehaOS"],
    ["/projects/cs-skin-invest", "CS"],
    ["/projects/moss-world", "Moss"],
  ];
  const results = [];
  for (const [route, expected] of routes) {
    await send("Page.navigate", { url: `${base}${route}` });
    await waitFor(`document.readyState === 'complete'`, 20000, `${route} 加载`);
    await sleep(150);
    const body = await evaluate(`(() => ({
      path: location.pathname,
      h1: document.querySelector('h1')?.textContent?.trim() ?? '',
      textLength: document.body.innerText.trim().length,
      title: document.title,
    }))()`);
    results.push({ route, expected, ...body });
    assert.equal(body.path, route, `${route} 路由应正确`);
    assert.ok(body.h1.includes(expected), `${route} 应渲染「${expected}」标题（实际 ${body.h1}）`);
    assert.ok(body.textLength > 80, `${route} 应有真实内容`);
  }
  console.log(`routes(${stage}):`, results.map((item) => `${item.route}=${item.h1}`));
  return results;
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Accessibility.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await mkdir(outDir, { recursive: true });

  const report = { base, viewport: "1440x900", steps: {}, routes: {}, routeResults: [], screenshots: [] };

  // 清理上一次验收残留（只清探索进度，不碰音频等用户偏好）
  await send("Page.navigate", { url: `${base}/projects` });
  await waitFor(`document.readyState === 'complete'`, 30000, "清理页加载");
  await evaluate(`(() => {
    try { localStorage.removeItem(${JSON.stringify(STORAGE_KEY)}); } catch {}
    return true;
  })()`);

  // ---------- 1. 首访：空进度 ----------
  await navigateWorld("?debug=1&tier=high");
  let ui = await readUI();
  assert.equal(ui.summary, "0 / 5 瓣记忆已点亮");
  assert.equal(ui.items.length, 5);
  assert.deepEqual(completedIds(ui), []);
  assert.equal(ui.memory?.lit, 0);
  assert.equal(ui.note, null, "正常 Storage 不应显示会话回退提示");
  assert.equal(parseStored(ui.storageRaw), null, "首访不应有本地记录");
  await openNav();
  await scrollProgressIntoView();
  await screenshot("01-nav-progress-empty");
  report.steps.empty = { ui, summary: ui.summary };
  await closeNav();
  await screenshot("02-world-spawn-empty");

  // ---------- 2. 完成三个项目体验（Teleport + 真实指针点击） ----------
  const agehaos = await completeExperience("Digit1", "终端体验", 1);
  report.steps.agehaos = {
    notice: agehaos.ui.notice,
    count: agehaos.ui.summary,
    memory: agehaos.ui.memory,
    stored: parseStored(agehaos.ui.storageRaw),
    option: agehaos.ui.isle?.agehaos?.option ?? null,
  };
  assert.equal(agehaos.ui.notice?.includes("终端体验"), true, "完成 AgehaOS 后应有一次性奖励提示");
  assert.equal(agehaos.ui.memory?.lit, 1);
  assert.equal(agehaos.ui.isle?.agehaos?.option, "windows", "AgehaOS 演示状态应已切换");

  const cs = await completeExperience("Digit2", "观测体验", 2);
  report.steps.cs = {
    notice: cs.ui.notice,
    count: cs.ui.summary,
    memory: cs.ui.memory,
    stored: parseStored(cs.ui.storageRaw),
    option: cs.ui.isle?.["cs-skin-invest"]?.option ?? null,
  };
  assert.equal(cs.ui.summary, "2 / 5 瓣记忆已点亮");
  assert.equal(cs.ui.memory?.lit, 2);
  assert.equal(cs.ui.isle?.["cs-skin-invest"]?.option, "portfolio");

  const moss = await completeExperience("Digit3", "穹舱光照", 3);
  report.steps.moss = {
    notice: moss.ui.notice,
    count: moss.ui.summary,
    memory: moss.ui.memory,
    stored: parseStored(moss.ui.storageRaw),
    option: moss.ui.isle?.["moss-world"]?.option ?? null,
  };
  assert.equal(moss.ui.summary, "3 / 5 瓣记忆已点亮");
  assert.equal(moss.ui.memory?.lit, 3);
  assert.equal(moss.ui.isle?.["moss-world"]?.option, "morning");

  const storedAfter3 = parseStored(moss.ui.storageRaw);
  assert.equal(storedAfter3?.version, 1);
  assert.deepEqual(storedAfter3?.completed, [
    "agehaos-experience",
    "cs-experience",
    "moss-experience",
  ]);
  assert.equal(storedAfter3 && Object.keys(storedAfter3).sort().join(","), "completed,version");

  // 世界奖励视觉：回到主岛出生点，记忆环与广场同屏
  await returnToSpawnAndSettle();
  await screenshot("03-memory-ring-lit");
  await openNav();
  await scrollProgressIntoView();
  await screenshot("04-nav-progress-3");
  // 已完成状态下项目详情仍可打开
  await evaluate(`document.querySelector('#world-progress-title')?.scrollIntoView({ block: "start", behavior: "instant" })`);
  await closeNav();
  await openNav();
  const agehaosDetailButton = `[data-world-panel="nav"] .world-nav__card:first-child .world-nav__card-actions button:last-child`;
  await clickSelector(agehaosDetailButton, { label: "AgehaOS 详情按钮" });
  await waitFor(`Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open'))`, 4000, "详情面板");
  const detailUi = await readUI();
  assert.equal(detailUi.detailTitle, "AgehaOS");
  assert.ok(detailUi.detailLinks.some((href) => href?.startsWith("/projects/agehaos")), "详情应保留项目路由");
  report.steps.detailWithProgress = { title: detailUi.detailTitle, links: detailUi.detailLinks };
  await press("Escape", 180);
  await waitFor(`!document.querySelector('[data-world-panel="detail"].world-panel--open')`, 4000, "详情关闭");

  // ---------- 3. 刷新后保留；复访不重复奖励 ----------
  await navigateWorld("?debug=1&tier=high");
  ui = await readUI();
  report.steps.afterRefresh = {
    summary: ui.summary,
    memory: ui.memory,
    notice: ui.notice,
    stored: parseStored(ui.storageRaw),
  };
  assert.equal(ui.summary, "3 / 5 瓣记忆已点亮", "刷新后应恢复 3/5");
  assert.equal(ui.memory?.lit, 3, "刷新后记忆环应恢复点亮瓣数");
  assert.equal(ui.notice, null, "刷新 / 复访不应重复弹奖励提示");

  await approachProject("Digit1", "终端体验");
  await clickSelector('.world-experience__btn', { label: "复访 AgehaOS 选项" });
  await sleep(350);
  ui = await readUI();
  report.steps.revisit = {
    summary: ui.summary,
    notice: ui.notice,
    memory: ui.memory,
    stored: parseStored(ui.storageRaw),
  };
  assert.equal(ui.summary, "3 / 5 瓣记忆已点亮", "复访已完成目标不应改变计数");
  assert.equal(ui.notice, null, "复访已完成目标不应重复弹奖励");

  // ---------- 4. 键盘可达与可访问名称 ----------
  await closeNav();
  // HUD 导航按钮打开，确保关闭后焦点能回到触发者
  const navButton = `button[aria-label^="打开世界导航"]`;
  await evaluate(`document.querySelector(${JSON.stringify(navButton)})?.focus()`);
  await clickSelector(navButton, { label: "HUD 导航按钮" });
  await waitFor(`Boolean(document.querySelector('[data-world-panel="nav"].world-panel--open'))`, 4000, "导航打开");
  await frames(2);
  const focusAfterOpen = await readUI();
  assert.equal(focusAfterOpen.activePanel, "nav");
  let tabCount = 0;
  let reachedReset = false;
  while (tabCount < 40 && !reachedReset) {
    await press("Tab", 40);
    tabCount += 1;
    reachedReset = await evaluate(
      `document.activeElement?.getAttribute('aria-controls') === 'world-progress-reset-confirm'`,
    );
  }
  assert.ok(reachedReset, `Tab 应能到达「重置探索进度」按钮（已按 ${tabCount} 次）`);
  await press("Enter", 200);
  await waitFor(
    `document.querySelector('button[aria-controls="world-progress-reset-confirm"]')?.getAttribute('aria-expanded') === "true"`,
    3000,
    "重置确认展开",
  );
  const confirmFocus = await readUI();
  assert.equal(confirmFocus.activeElement.text, "确认重置", "展开确认后焦点应落到确认按钮");
  const ax = await send("Accessibility.getFullAXTree");
  const axNames = ax.nodes.map((node) => node.name?.value).filter(Boolean);
  assert.ok(axNames.includes("探索进度"), "进度区应有可访问名称「探索进度」");
  assert.ok(axNames.includes("重置探索进度"), "重置按钮应有可访问名称");
  assert.ok(axNames.includes("确认重置"), "确认按钮应有可访问名称");
  await screenshot("05-reset-confirm-keyboard");
  await press("Escape", 200);
  await waitFor(`!document.querySelector('[data-world-panel="nav"].world-panel--open')`, 4000, "Esc 关闭导航");
  await waitFor(
    `document.activeElement?.getAttribute('aria-label')?.startsWith('打开世界导航') === true`,
    3000,
    "关闭后焦点归还 HUD 导航按钮",
  );
  const focusAfterClose = await readUI();
  assert.equal(
    focusAfterClose.activeElement.label?.startsWith("打开世界导航"),
    true,
    `关闭后焦点应回到 HUD 导航按钮（实际 ${JSON.stringify(focusAfterClose.activeElement)}）`,
  );
  report.steps.keyboard = { tabCount, focusAfterOpen, confirmFocus, focusAfterClose };

  // ---------- 5. 重置 → 清空 → 可再次触发 ----------
  await openNav();
  await scrollProgressIntoView();
  await clickSelector('button[aria-controls="world-progress-reset-confirm"]', { label: "重置探索进度" });
  await waitFor(
    `document.querySelector('button[aria-controls="world-progress-reset-confirm"]')?.getAttribute('aria-expanded') === "true"`,
    3000,
    "重置确认展开",
  );
  await screenshot("06-reset-confirm-pointer");
  await clickSelector('.world-nav__card-btn--danger', { label: "确认重置" });
  await waitFor(
    `document.querySelectorAll('[data-world-panel="nav"] .world-progress__item[data-done="true"]').length === 0`,
    4000,
    "进度清零",
  );
  await waitFor(
    `document.activeElement?.textContent?.trim() === '重置探索进度'`,
    3000,
    "重置后焦点回到重置按钮",
  );
  ui = await readUI();
  const emptyStored = parseStored(ui.storageRaw);
  report.steps.reset = {
    summary: ui.summary,
    items: ui.items,
    memory: ui.memory,
    note: ui.note,
    warning: ui.warning,
    stored: emptyStored,
    isle: ui.isle,
    focus: ui.activeElement,
  };
  assert.equal(ui.summary, "0 / 5 瓣记忆已点亮");
  assert.deepEqual(completedIds(ui), []);
  assert.equal(ui.memory?.lit, 0, "重置后记忆环应复位");
  assert.equal(ui.warning, null);
  assert.ok(
    emptyStored === null || emptyStored.completed?.length === 0,
    "重置应清除本地完成 id（键删除或空数组）",
  );
  assert.equal(ui.isle?.agehaos?.option, null, "重置应清除 AgehaOS 演示状态");
  assert.equal(ui.isle?.["cs-skin-invest"]?.option, null, "重置应清除 CS 演示状态");
  assert.equal(ui.isle?.["moss-world"]?.option, null, "重置应清除 Moss 演示状态");
  assert.equal(ui.nookButton, false, "重置后不应残留茧居所已发现入口");
  assert.equal(ui.activeElement.text, "重置探索进度", "重置完成后焦点应回到重置按钮");
  await screenshot("07-nav-progress-reset");
  await closeNav();
  await returnToSpawnAndSettle();
  const resetLayout = await readUI();
  report.steps.layoutAfterReset = {
    viewport: resetLayout.viewport,
    layout: resetLayout.layout,
  };
  assert.equal(resetLayout.layout?.root?.width, 1440, "重置后世界根节点应保持全宽");
  assert.equal(resetLayout.layout?.canvas?.x, 0, "重置后画布不应被面板滚动推离原位");
  assert.equal(resetLayout.layout?.hud?.x, 0, "重置后 HUD 不应被面板滚动推离原位");
  await screenshot("08-memory-ring-reset");

  // 重置后目标可再次触发
  const again = await completeExperience("Digit1", "终端体验", 1);
  report.steps.retrigger = {
    summary: again.ui.summary,
    notice: again.ui.notice,
    memory: again.ui.memory,
    stored: parseStored(again.ui.storageRaw),
  };
  assert.equal(again.ui.summary, "1 / 5 瓣记忆已点亮", "重置后同一目标应可再次完成");
  assert.equal(again.ui.notice?.includes("终端体验"), true);
  // 最终再重置，验证刷新后保持空进度
  await openNav();
  await scrollProgressIntoView();
  await clickSelector('button[aria-controls="world-progress-reset-confirm"]', { label: "再次重置" });
  await clickSelector('.world-nav__card-btn--danger', { label: "再次确认重置" });
  await waitFor(
    `document.querySelectorAll('[data-world-panel="nav"] .world-progress__item[data-done="true"]').length === 0`,
    4000,
    "再次清零",
  );
  await closeNav();
  await navigateWorld("?debug=1&tier=high");
  ui = await readUI();
  report.steps.resetRefresh = { summary: ui.summary, stored: parseStored(ui.storageRaw), memory: ui.memory };
  assert.equal(ui.summary, "0 / 5 瓣记忆已点亮", "重置后刷新应保持空进度");
  assert.equal(ui.memory?.lit, 0);

  // 0 进度下项目详情仍可打开
  await openNav();
  await clickSelector(agehaosDetailButton, { label: "0 进度 AgehaOS 详情" });
  await waitFor(`Boolean(document.querySelector('[data-world-panel="detail"].world-panel--open'))`, 4000, "0 进度详情");
  const zeroDetail = await readUI();
  assert.equal(zeroDetail.detailTitle, "AgehaOS");
  report.steps.detailAtZero = { title: zeroDetail.detailTitle };
  await press("Escape", 180);

  // 导航路由链接齐全（探索不是唯一入口）
  await openNav();
  const navLinks = (await readUI()).routeLinks;
  for (const href of ["/projects", "/about", "/tech", "/contact", "/articles"]) {
    assert.ok(navLinks.includes(href), `世界导航应包含 ${href}`);
  }
  report.steps.navLinks = navLinks;
  await closeNav();

  // ---------- 6. 存储完全不可用 ----------
  const { identifier: blockedScript } = await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const proto = window.Storage && window.Storage.prototype;
      if (!proto) return;
      const fail = function () { throw new DOMException('P4 storage blocked', 'SecurityError'); };
      proto.getItem = fail;
      proto.setItem = fail;
      proto.removeItem = fail;
    })();`,
  });
  await navigateWorld("?debug=1&tier=high");
  ui = await readUI();
  assert.equal(ui.summary, "0 / 5 瓣记忆已点亮");
  assert.ok(ui.note?.includes("本地存储不可用"), "Storage 不可用时应如实提示");
  assert.equal(ui.storageRaw, "THREW");
  await openNav();
  await scrollProgressIntoView();
  await screenshot("09-storage-unavailable");
  await closeNav();

  // 不可用时仍可完成目标、打开详情、浏览页面
  const blockedComplete = await completeExperience("Digit1", "终端体验", 1);
  report.steps.storageBlocked = {
    notice: blockedComplete.ui.notice,
    summary: blockedComplete.ui.summary,
    memory: blockedComplete.ui.memory,
    note: blockedComplete.ui.note,
    storage: blockedComplete.ui.storageRaw,
  };
  assert.equal(blockedComplete.ui.summary, "1 / 5 瓣记忆已点亮", "Storage 不可用时应退化为会话内进度");
  assert.ok(blockedComplete.ui.note?.includes("本地存储不可用"));
  const routeResultsBlocked = await runRouteChecks("storage-blocked");
  report.routeResults.push(...routeResultsBlocked);

  // 刷新后会话进度丢失（如实回退）
  await navigateWorld("?debug=1&tier=high");
  ui = await readUI();
  report.steps.storageBlockedReload = { summary: ui.summary, note: ui.note, storage: ui.storageRaw };
  assert.equal(ui.summary, "0 / 5 瓣记忆已点亮", "Storage 不可用时刷新不保留进度");
  assert.ok(ui.note?.includes("本地存储不可用"));
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: blockedScript });

  // ---------- 7. 写入失败（读正常）----------
  await navigateWorld("?debug=1&tier=high");
  await evaluate(`(() => {
    window.__P4_ORIGINAL_SET_ITEM__ = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException('P4 write blocked', 'QuotaExceededError');
    };
    return true;
  })()`);
  const writeFail = await completeExperience("Digit1", "终端体验", 1);
  await openNav();
  await scrollProgressIntoView();
  const writeFailUi = await readUI();
  report.steps.storageWriteFail = {
    summary: writeFailUi.summary,
    note: writeFailUi.note,
    storage: writeFailUi.storageRaw,
    notice: writeFail.notice,
    memory: writeFail.memory,
  };
  assert.equal(writeFailUi.summary, "1 / 5 瓣记忆已点亮", "写入失败时进度仍在会话内生效");
  assert.ok(writeFailUi.note?.includes("本地存储不可用"), "写入失败应切换为会话内提示");
  assert.equal(writeFailUi.storageRaw, null, "写入失败不应留下记录");
  await screenshot("10-storage-write-fail");
  await closeNav();

  // ---------- 8. 视口 / 移动端 / 尺度 ----------
  const resetStorage = async () => {
    await evaluate(`(() => {
      try { localStorage.removeItem(${JSON.stringify(STORAGE_KEY)}); } catch {}
      return true;
    })()`);
  };
  await resetStorage();
  await navigateWorld("?debug=1&tier=high");

  // 窄且矮的桌面窗口
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 650,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigateWorld("?debug=1&tier=high");
  await openNav();
  await scrollProgressIntoView();
  ui = await readUI();
  assert.equal(ui.items.length, 5);
  assert.ok(ui.viewport.scrollWidth <= ui.viewport.clientWidth + 1, "窄桌面不应横向溢出");
  assert.ok(ui.resetRect && ui.resetRect.height >= 43, "重置按钮触控高度应 ≥44px");
  await screenshot("11-desktop-narrow-1024x650");
  report.steps.desktopNarrow = { viewport: ui.viewport, resetRect: ui.resetRect };
  await closeNav();

  // 移动端竖屏
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await navigateWorld("?debug=1&tier=medium");
  await openNav();
  await scrollProgressIntoView();
  ui = await readUI();
  assert.equal(ui.mobileLike, true, "390px 视口应判定为移动端形态");
  assert.ok(ui.viewport.scrollWidth <= ui.viewport.clientWidth + 1, "移动端不应横向溢出");
  assert.ok(ui.panel && ui.panel.height <= 844, "移动端面板不应超出视口");
  assert.ok(ui.resetRect && ui.resetRect.height >= 43, "移动端重置按钮触控高度应 ≥44px");
  await screenshot("12-mobile-portrait-nav");
  report.steps.mobilePortrait = { viewport: ui.viewport, panel: ui.panel, resetRect: ui.resetRect };
  await closeNav();

  // 移动端横屏
  await send("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await navigateWorld("?debug=1&tier=medium");
  await openNav();
  await scrollProgressIntoView();
  ui = await readUI();
  assert.ok(ui.viewport.scrollWidth <= ui.viewport.clientWidth + 1, "横屏不应横向溢出");
  assert.ok(ui.panel && ui.panel.height <= 390, "横屏面板不应超出视口");
  await screenshot("13-mobile-landscape-nav");
  report.steps.mobileLandscape = { viewport: ui.viewport, panel: ui.panel, resetRect: ui.resetRect };
  await closeNav();

  // 桌面文字放大 200%
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await navigateWorld("?debug=1&tier=high");
  await evaluate(`document.documentElement.style.fontSize = '200%'`);
  await frames(4);
  await openNav();
  await scrollProgressIntoView();
  ui = await readUI();
  assert.ok(ui.viewport.scrollWidth <= ui.viewport.clientWidth + 1, "200% 文字不应横向溢出");
  assert.ok(ui.resetRect && ui.resetRect.height >= 43, "200% 文字下重置按钮仍可点击");
  await screenshot("14-text-zoom-200");
  report.steps.textZoom = { viewport: ui.viewport, resetRect: ui.resetRect, panel: ui.panel };
  await closeNav();

  // ---------- 9. 低画质 + 恢复茧居所发现（版本化存档）----------
  await evaluate(`(() => {
    localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify({
      version: 1,
      completed: ["nook-discovery"],
    }));
    return true;
  })()`);
  await navigateWorld("?debug=1&tier=low");
  ui = await readUI();
  assert.equal(ui.tier, "low", "应固定为低画质档");
  assert.equal(ui.summary, "1 / 5 瓣记忆已点亮", "低画质应恢复本地进度");
  assert.equal(ui.memory?.lit, 1);
  assert.equal(ui.nookButton, true, "已发现的茧居所应恢复导航入口");
  await openNav();
  await scrollProgressIntoView();
  await screenshot("15-low-tier-progress");
  report.steps.lowTier = {
    tier: ui.tier,
    summary: ui.summary,
    memory: ui.memory,
    nookButton: ui.nookButton,
    notice: ui.note,
  };
  await closeNav();

  // 清理本地进度，避免留下验收残留
  await evaluate(`(() => { try { localStorage.removeItem(${JSON.stringify(STORAGE_KEY)}); } catch {} return true; })()`);

  const sceneErrors = errors.filter((error) => !/synchronously unmount a root/i.test(String(error)));
  report.errors = sceneErrors;
  report.final = {
    allSteps: Object.keys(report.steps),
    routeChecks: report.routeResults.length,
  };
  await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(sceneErrors, [], "浏览器控制台不应有本轮引入的运行时异常");
  console.log("P4 browser verification passed");
  console.log("steps:", Object.keys(report.steps).join(", "));
  console.log("routes:", report.routeResults.map((item) => item.route).join(", "));
} finally {
  socket.close();
}
