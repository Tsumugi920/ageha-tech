/**
 * 首页世界入口测试（node:test）：
 * Hero.tsx 已随首页 3D 化退役（蓝图 §14.0/§14.1）——原 Hero 首屏文案契约
 * 逐字搬迁至世界 HTML 信息层新家：品牌标题 → WorldShell/LoadingScreen 的
 * 常驻 <h1>；个人简介 / 双按钮 / 统计口径 → IntroToast 首次引导卡。
 * 本文件守护搬迁后的文案一字不差、加载屏真实进度纪律、世界沉浸 CSS、
 * ButterflyLogo 接口稳定与站点图标就位，并保证无 emoji 混入。
 * 运行方式：npm test（即 node --test tests/*.test.mjs）
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test("世界品牌标题一字不差：h1 常驻 SSR，加载态大字 → 就绪态 HUD 角标", () => {
  const brand = readProjectFile("components/world/loading/LoadingScreen.tsx");

  // 品牌标题与 tagline（tagline 与 metadata 同源 lib/site.ts:30）
  assert.match(brand, /<h1 className="world-brand__title">Ageha\.tech<\/h1>/);
  assert.match(readProjectFile("lib/site.ts"), /用技术构建更有趣的数字世界/);
  assert.match(brand, /用技术构建更有趣的数字世界/);
  // 同一 h1 节点经 CSS 过渡收缩为角标（§13.1：节点不卸载、文字不变）
  assert.match(brand, /world-brand--dock/);
  const css = readProjectFile("app/globals.css");
  assert.match(css, /\.world-brand--dock\s*\{/);
  assert.match(css, /transition:[^;]*cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
});

test("IntroToast 文案一字不差：个人简介 / 双按钮 / 统计口径（自 Hero 逐字搬迁）", () => {
  const toast = readProjectFile("components/world/ui/IntroToast.tsx");

  // 个人介绍（一字不差，含「有趣且优雅」高亮）
  assert.match(
    toast,
    /我是 Ageha，一名独立开发者，热爱探索技术与设计的边界，致力于构建有价值、/,
  );
  assert.match(toast, /有趣且优雅/);
  assert.match(toast, /的数字产品。/);

  // 按钮：主（/projects）+ 次（/about）
  assert.match(toast, /href="\/projects"/);
  assert.match(toast, /查看我的项目/);
  assert.match(toast, /href="\/about"/);
  assert.match(toast, /了解我/);

  // 摘要统计（口径与站内可数内容对齐：3 个项目、16 项在用/在学技术，
  // 数据级对齐校验见 contrast.test.mjs；∞ 为装饰性表达）
  assert.match(toast, /3\+/);
  assert.match(toast, /代表项目/);
  assert.match(toast, /\{ value: "16", label: "在用\/在学技术" \}/);
  assert.match(toast, /∞/);
  assert.match(toast, /持续探索/);

  // 引导卡纪律：可关闭、任意操作即隐（§13.1）
  assert.match(toast, /开始探索/);
  assert.match(toast, /pointerdown/);
  assert.match(toast, /Escape/);
});

test("加载屏：真实进度纪律（useProgress 实测，禁假百分比）+ 品牌呼吸", () => {
  const loading = readProjectFile("components/world/loading/LoadingScreen.tsx");
  assert.match(loading, /useProgress/);
  assert.match(loading, /正在点亮群岛/);
  // 百分比只能来自 useProgress 的 progress 实测值（模板插值），
  // 不允许硬编码假进度字面量
  assert.doesNotMatch(loading, /9[05]%|100%/);
  const css = readProjectFile("app/globals.css");
  assert.match(css, /@keyframes world-breathe/);
  assert.match(css, /@keyframes world-progress-sweep/);
});

test("世界沉浸 CSS：body:has(#world-root) 隐藏 Footer / 禁滚动，HUD 玻璃令牌就位", () => {
  const css = readProjectFile("app/globals.css");

  assert.match(css, /body:has\(#world-root\)\s*\{/);
  const immersive = css.slice(css.indexOf("body:has(#world-root)"));
  assert.match(immersive, /overflow:\s*hidden/);
  assert.match(immersive, /footer\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.world-root\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.world-canvas\s*\{[^}]*touch-action:\s*none/);
  // HUD 件类就位（§13.3）
  for (const cls of [
    ".world-hud__zone",
    ".world-hud__prompt",
    ".world-hud__hint",
    ".world-hud__quick",
    ".world-toast",
    ".world-joystick",
    ".world-nameplate",
    ".world-fallback",
  ]) {
    assert.ok(css.includes(cls), `globals.css 应有 ${cls}`);
  }
});

test("prefers-reduced-motion 下世界层动画静止且文字完整可读", () => {
  const css = readProjectFile("app/globals.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const reducedBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  // 世界层专用降级 + 全局兜底（动画 / 过渡 / 平滑滚动瞬时化）
  assert.match(reducedBlock, /\.world-brand__logo[^{]*\{[^}]*animation:\s*none/);
  assert.match(reducedBlock, /\*,\s*\*::before,\s*\*::after\s*\{/);
  assert.match(reducedBlock, /animation-duration:\s*0\.01ms !important/);
});

test("ButterflyLogo：几何切面蓝紫渐变，接口保持 gradientId / className / title", () => {
  const logo = readProjectFile("components/layout/ButterflyLogo.tsx");

  assert.match(logo, /gradientId: string/);
  assert.match(logo, /className\?: string/);
  assert.match(logo, /title\?: string/);
  assert.match(logo, /linearGradient/);
  assert.match(logo, /url\(#\$\{gradientId\}\)/);
  assert.match(logo, /#54E3FF/);
  assert.match(logo, /#9C83FF/);
  // 调用方无需改动（世界加载屏复用同一 Logo）
  assert.match(readProjectFile("components/layout/Navbar.tsx"), /gradientId="navbar-butterfly"/);
  assert.match(readProjectFile("components/layout/Footer.tsx"), /gradientId="footer-butterfly"/);
  assert.match(
    readProjectFile("components/world/loading/LoadingScreen.tsx"),
    /gradientId="world-butterfly"/,
  );
});

test("app/icon.svg 站点图标就位：渐变 + 蝴蝶四翅 + 星芒，非空有效 SVG", () => {
  const iconPath = path.join(projectRoot, "app", "icon.svg");
  assert.ok(existsSync(iconPath), "缺少 app/icon.svg");
  assert.ok(statSync(iconPath).size > 0, "app/icon.svg 不应为空");

  const icon = readProjectFile("app/icon.svg");
  assert.match(icon, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(icon, /linearGradient/);
  // 四片翅膀 + 切面 + 星芒
  const wingPaths = icon.match(/M22\.6 19\.6|M25\.4 19\.6|M22\.8 25\.4|M25\.2 25\.4/g);
  assert.ok(wingPaths && wingPaths.length === 4, "应有三段上翅/下翅路径（左右各二）");
  assert.match(icon, /url\(#icon-wing-upper\)/);
  assert.match(icon, /url\(#icon-wing-lower\)/);
});

test("世界入口相关文件不包含 emoji（主视觉禁止 emoji 拼凑）", () => {
  const files = [
    "components/world/WorldShell.tsx",
    "components/world/loading/LoadingScreen.tsx",
    "components/world/ui/IntroToast.tsx",
    "components/world/ui/HudOverlay.tsx",
    "components/layout/ButterflyLogo.tsx",
    "app/icon.svg",
  ];
  const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  for (const file of files) {
    assert.doesNotMatch(readProjectFile(file), emojiPattern, `${file} 不应包含 emoji`);
  }
});
