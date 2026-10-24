/**
 * Hero 首屏测试（node:test）：
 * 校验首屏文案一字不差、场景实现要点、hero 专用样式与减弱动效降级、
 * 蝴蝶 Logo 接口稳定与站点图标就位，并保证无 emoji 混入。
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

test("Hero 文案一字不差：品牌组合标题 / 中文双行 / 简介 / 按钮 / 摘要", () => {
  const hero = readProjectFile("components/home/Hero.tsx");

  // Eyebrow 与品牌标题（identity 由 lib/site.ts 提供，见 site.test.mjs）
  assert.match(hero, /\{site\.identity\}/);
  assert.match(readProjectFile("lib/site.ts"), /INDEPENDENT DIGITAL CREATOR/);
  assert.match(hero, /Ageha\./);
  assert.match(hero, /hero-gradient-tech">tech</);

  // 中文主标题两行（一字不差，含句末句号）
  assert.match(hero, /用技术构建/);
  assert.match(hero, /更有趣的数字世界。/);

  // 个人介绍（一字不差）与「有趣且优雅」渐变高亮
  assert.match(
    hero,
    /我是 Ageha，一名独立开发者，热爱探索技术与设计的边界，致力于构建有价值、/,
  );
  assert.match(hero, /有趣且优雅/);
  assert.match(hero, /的数字产品。/);
  assert.match(hero, /hero-gradient-accent/);

  // 按钮：主（/projects）+ 次（#about）
  assert.match(hero, /href="\/projects"/);
  assert.match(hero, /查看我的项目/);
  assert.match(hero, /href="#about"/);
  assert.match(hero, /了解我/);

  // 摘要统计（口径与站内可数内容对齐：3 个项目、16 项在用/在学技术，
  // 数据级对齐校验见 contrast.test.mjs）
  assert.match(hero, /3\+/);
  assert.match(hero, /代表项目/);
  assert.match(hero, /\{ value: "16", label: "在用\/在学技术" \}/);
  assert.match(hero, /∞/);
  assert.match(hero, /持续探索/);
});

test("Hero 右缘面板与左缘滚动提示：品牌短句 / 分页 / 六章 / SCROLL", () => {
  const hero = readProjectFile("components/home/Hero.tsx");

  assert.match(hero, /BUILDING DIGITAL THINGS WITH CURIOSITY\./);
  assert.match(hero, /hero-vtext/);

  // 六个章节（01 当前高亮 → aria-current）
  for (const label of ["Explore", "Build", "Create", "Iterate", "Share", "More"]) {
    assert.match(hero, new RegExp(`label: "${label}"`));
  }
  for (const num of ["01", "02", "03", "04", "05", "06"]) {
    assert.match(hero, new RegExp(`"${num}"`));
  }
  assert.match(hero, /aria-current=/);

  assert.match(hero, /SCROLL/);
  assert.match(hero, /hero-knob/);
});

test("HeroScene：场景主视觉 + 遮罩渐隐 + 轨道环 / 光晕 / 光点 / 悬浮", () => {
  const scene = readProjectFile("components/home/HeroScene.tsx");

  assert.match(scene, /\/images\/hero-clean\.png/);
  assert.match(scene, /alt=""/);
  assert.match(scene, /aria-hidden="true"/);
  assert.match(scene, /priority/);
  assert.match(scene, /hero-scene-mask/);
  assert.match(scene, /hero-orbit/);
  assert.match(scene, /hero-glow/);
  assert.match(scene, /hero-particle/);
  assert.match(scene, /hero-float/);
  // 纯 CSS + 少量事件：场景组件本身不引入动画库
  assert.doesNotMatch(scene, /requestAnimationFrame|gsap|framer-motion/i);
});

test("globals.css hero 专用块：渐变文字 / 按钮 / 遮罩 / 关键帧 / 视差，且不动既有令牌", () => {
  const css = readProjectFile("app/globals.css");

  assert.match(css, /\.hero-gradient-tech\s*\{/);
  assert.match(css, /\.hero-gradient-zh\s*\{/);
  assert.match(css, /\.hero-gradient-accent\s*\{/);
  assert.match(css, /\.hero-primary-btn\s*\{/);
  assert.match(css, /\.hero-ghost-btn\s*\{/);
  assert.match(css, /\.hero-scene-mask\s*\{/);
  assert.match(css, /mask-image:\s*radial-gradient\(/i);
  assert.match(css, /@keyframes hero-rise/);
  assert.match(css, /@keyframes hero-float/);
  assert.match(css, /@keyframes hero-spin/);
  assert.match(css, /@keyframes hero-drift/);
  assert.match(css, /@keyframes hero-breathe/);
  assert.match(css, /--hero-px/);
  // 视差仅精确指针设备启用
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  // 既有设计令牌保持原样
  assert.match(css, /--color-sky:\s*#DDF3FF/i);
  assert.match(css, /--color-purple:\s*#9C83FF/i);
});

test("prefers-reduced-motion 下 Hero 全部动画静止且文字完整可读", () => {
  const css = readProjectFile("app/globals.css");

  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const reducedBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reducedBlock, /\.hero-reveal\s*\{[^}]*animation:\s*none/);
  assert.match(reducedBlock, /opacity:\s*1/);
  for (const cls of [
    ".hero-float",
    ".hero-glow",
    ".hero-orbit",
    ".hero-particle",
    ".hero-knob",
  ]) {
    assert.ok(
      reducedBlock.includes(cls),
      `reduced-motion 块应静止 ${cls}`,
    );
  }
  assert.match(reducedBlock, /\.hero-px-deep/);
});

test("Hero 离屏暂停（IntersectionObserver）与视差仅在客户端增强", () => {
  const hero = readProjectFile("components/home/Hero.tsx");

  assert.match(hero, /"use client"/);
  assert.match(hero, /IntersectionObserver/);
  assert.match(hero, /data-hero-active/);
  assert.match(hero, /pointermove/);
  assert.match(hero, /prefers-reduced-motion: reduce/);
  assert.match(hero, /hover: hover/) ;
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
  // Navbar / Footer 调用方无需改动
  assert.match(readProjectFile("components/layout/Navbar.tsx"), /gradientId="navbar-butterfly"/);
  assert.match(readProjectFile("components/layout/Footer.tsx"), /gradientId="footer-butterfly"/);
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

test("Hero 相关文件不包含 emoji（主视觉禁止 emoji 拼凑）", () => {
  const files = [
    "components/home/Hero.tsx",
    "components/home/HeroScene.tsx",
    "components/layout/ButterflyLogo.tsx",
    "app/icon.svg",
  ];
  const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  for (const file of files) {
    assert.doesNotMatch(readProjectFile(file), emojiPattern, `${file} 不应包含 emoji`);
  }
});
