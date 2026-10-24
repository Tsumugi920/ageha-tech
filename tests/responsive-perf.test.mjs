/**
 * 响应式与性能打磨测试（node:test）：
 * 覆盖五个承诺维度 —— 断点布局（320/390/768/1024/1440 不横溢的静态前提）、
 * ≥44px 触控面积、focus-visible 焦点环、玻璃面板对比度令牌、
 * 性能（图片加载策略 / Hero 预留空间 / 持续运行动画减量 / reduced-motion 全覆盖）。
 * 断言基于源码与 CSS 解析；浏览器实测由构建流程另行执行。
 * 运行方式：npm test（即 node --test "tests/*.test.mjs"）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

/**
 * 从 CSS 中按选择器名抽取规则块（花括号配平），
 * 用于断言 will-change / clamp 等声明所在位置。
 */
function extractRuleBlocks(css, selectorPattern) {
  const blocks = [];
  const pattern = new RegExp(selectorPattern + "\\s*\\{", "g");
  let match;
  while ((match = pattern.exec(css)) !== null) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push({ start: match.index, end: i, body: css.slice(open + 1, i) });
          break;
        }
      }
    }
  }
  return blocks;
}

/* ============================ 一、断点布局 ============================ */

test("断点布局：项目卡片移动单列、md 起三列（首页精选与 /projects 列表一致）", () => {
  for (const file of [
    "components/home/FeaturedProjects.tsx",
    "app/projects/page.tsx",
  ]) {
    const src = readProjectFile(file);
    assert.match(src, /grid list-none gap-6 md:grid-cols-3/,
      `${file} 卡片网格应为移动单列 + md:grid-cols-3`);
  }
});

test("断点布局：时间线移动端独立纵排（lg 隐藏），桌面由 About 大板嵌套承接", () => {
  const journey = readProjectFile("components/home/JourneySection.tsx");
  // 独立形态：移动 / 平板全宽纵排列表，lg+ 隐藏（桌面形态见 nested）
  assert.match(journey, /lg:hidden/, "独立时间线版块应在 lg 以下渲染");
  assert.match(journey, /hidden lg:block/, "嵌套时间线应仅在 lg+ 渲染");
  // 时间线本体为纵向 <ol>（节点行 flex 纵排，无横向滚动容器）
  const card = journey.match(/<ol[\s\S]*?<\/ol>/);
  assert.ok(card, "时间线应为有序列表");
  assert.doesNotMatch(card[0], /overflow-x-auto|flex-row/, "时间线不应横排或横向滚动");
});

test("断点布局：技术栈移动端纵排（1 列 → sm 2 列 → xl 4 列）", () => {
  const section = readProjectFile("components/home/TechStackSection.tsx");
  assert.match(section, /grid gap-4 sm:grid-cols-2 xl:grid-cols-4/,
    "技术栈分组卡应为移动 1 列 / sm 2 列 / xl 4 列");
});

test("断点布局：移动端 Hero 纵向布局（上半场景横幅 + 下方文案）且整段 overflow-hidden", () => {
  const hero = readProjectFile("components/home/Hero.tsx");
  const scene = readProjectFile("components/home/HeroScene.tsx");

  // 场景容器：移动端 46svh 顶部横幅，lg+ 右侧 64% 双栏
  assert.match(scene, /h-\[46svh\] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-\[64%\]/);
  // 文案在场景之下：顶部内边距 ≥ 场景高度（纵向堆叠不重叠）
  assert.match(hero, /pt-\[46svh\] sm:px-10 lg:px-16 lg:pb-14 lg:pt-36/);
  // 横向溢出保险丝：轨道环 / 光斑等装饰超出画布时被首屏裁切
  assert.match(hero, /hero-root relative isolate flex min-h-\[calc\(100svh-4\.5rem\)\] flex-col overflow-hidden/);
});

test("断点布局：Hero 装饰层随断点收缩（移动端轨道 / 光晕更小），lg+ 恢复设计稿尺寸", () => {
  const css = readProjectFile("app/globals.css");

  const layerBlocks = extractRuleBlocks(css, "\\.hero-orbit-layer");
  assert.ok(layerBlocks.length >= 1, "globals.css 应有 .hero-orbit-layer 轨道尺寸变量");

  // 移动 / 平板值：上限明显小于设计稿（42rem / 52rem）
  const mobileBlock = layerBlocks[0].body;
  assert.match(mobileBlock, /--orbit-a:\s*clamp\(16rem,\s*52vw,\s*42rem\)/);
  assert.match(mobileBlock, /--orbit-b:\s*clamp\(20rem,\s*66vw,\s*52rem\)/);

  // lg+ 恢复设计稿轨道尺寸（与原内联值逐字一致）
  const lgBlock = css.match(/@media \(min-width: 1024px\)\s*\{\s*\.hero-orbit-layer\s*\{([\s\S]*?)\}/);
  assert.ok(lgBlock, "应有 lg 断点的轨道尺寸恢复规则");
  assert.match(lgBlock[1], /--orbit-a:\s*clamp\(24rem,\s*46vw,\s*46rem\)/);
  assert.match(lgBlock[1], /--orbit-b:\s*clamp\(30rem,\s*60vw,\s*56rem\)/);

  // 光晕：移动端 14rem 起步，lg+ 恢复 22rem
  const scene = readProjectFile("components/home/HeroScene.tsx");
  assert.match(scene, /w-\[clamp\(14rem,44vw,40rem\)\] -translate-x-1\/2 -translate-y-1\/2 rounded-full lg:w-\[clamp\(22rem,44vw,40rem\)\]/);
});

test("断点布局：全站内容容器统一 max-w-6xl + 响应式水平内边距（无固定宽度横溢源）", () => {
  const pages = [
    "app/page.tsx",
    "app/projects/page.tsx",
    "app/about/page.tsx",
    "app/articles/page.tsx",
    "app/contact/page.tsx",
    "app/tech/page.tsx",
  ];
  for (const file of pages) {
    const src = readProjectFile(file);
    assert.doesNotMatch(src, /w-\[\d{3,}px\]|min-w-\[\d{3,}px\]/,
      `${file} 不应出现固定像素宽度`);
  }
  // 首页版块统一 max-w-6xl + px-4/md:px-8
  const featured = readProjectFile("components/home/FeaturedProjects.tsx");
  assert.match(featured, /max-w-6xl scroll-mt-24 px-4 py-20 md:px-8/);
});

/* ============================ 二、触控面积 ≥44px ============================ */

test("触控面积：汉堡按钮 44px、移动菜单条目与联系按钮 ≥44px 高", () => {
  const navbar = readProjectFile("components/layout/Navbar.tsx");
  const links = readProjectFile("components/layout/SiteNavLinks.tsx");

  assert.match(navbar, /inline-grid size-11 place-items-center/, "汉堡按钮应 ≥44px");
  // 菜单条目：py-3 + 15px 文本 ≈ 46px
  assert.match(links, /SHEET_ITEM =\s*\n\s*"flex items-center justify-between gap-3 rounded-2xl px-4 py-3/);
  // 菜单底部联系按钮：全宽 py-3（44px）
  assert.match(navbar, /className="w-full py-3"/);
});

test("触控面积：玻璃按钮基类 min-h-11，项目卡箭头 size-11", () => {
  const button = readProjectFile("components/ui/GlassButton.tsx");
  assert.match(button, /inline-flex min-h-11 cursor-pointer/,
    "GlassButton 基类应保证 ≥44px 高度");

  const card = readProjectFile("components/projects/ProjectCard.tsx");
  assert.match(card, /group\/arrow inline-grid size-11 shrink-0 place-items-center/,
    "项目卡圆形箭头应 ≥44px");
});

test("触控面积：Hero 按钮 / 联系按钮 / 章节速览行 ≥44px 高", () => {
  const css = readProjectFile("app/globals.css");
  // hero 主 / 次按钮：0.8rem 上下内边距 + 0.9375rem 文本 ≈ 46px
  const primaryBtn = css.match(/\.hero-primary-btn\s*\{([\s\S]*?)\}/);
  assert.ok(primaryBtn);
  assert.match(primaryBtn[1], /padding:\s*0\.8rem 1\.7rem/);

  const contact = readProjectFile("components/home/ContactSection.tsx");
  assert.match(contact, /px-6 py-3 text-sm font-semibold text-white/,
    "联系我按钮应 ≥44px 高");

  const hero = readProjectFile("components/home/Hero.tsx");
  assert.match(hero, /"py-3\.5 font-mono text-\[11px\] tracking-\[0\.14em]/,
    "章节速览行应 ≥44px 行高");
});

test("触控面积：小号文本链接以 tap-44 外扩命中区（品牌 / 胶囊导航 / View All / 查看更多）", () => {
  const css = readProjectFile("app/globals.css");
  // tap-44 工具类就位：透明 ::before 命中层，默认纵向外扩 ±0.75rem
  assert.match(css, /\.tap-44\s*\{[\s\S]*?position:\s*relative/);
  const tapBefore = css.match(/\.tap-44::before\s*\{([\s\S]*?)\}/);
  assert.ok(tapBefore, "缺少 .tap-44::before 命中区规则");
  assert.match(tapBefore[1], /var\(--tap-extend-y, -0\.75rem\)/);

  const navbar = readProjectFile("components/layout/Navbar.tsx");
  assert.match(navbar, /tap-44 flex shrink-0 items-center gap-2\.5/,
    "品牌链接应外扩命中区");

  const links = readProjectFile("components/layout/SiteNavLinks.tsx");
  assert.match(links, /tap-44 rounded-full px-3\.5 py-1\.5/,
    "导航胶囊项应外扩命中区");
  assert.match(links, /--tap-extend-x:0px/,
    "相邻胶囊左右不外扩，避免命中区重叠");
  assert.match(links, /className="py-3 text-sm font-medium text-text-secondary/,
    "页脚链接行应 ≥44px 高");

  for (const [file, marker] of [
    ["components/home/FeaturedProjects.tsx", 'tap-44 group inline-flex items-center gap-1.5 text-sm font-semibold text-link'],
    ["components/home/LatestNotes.tsx", 'tap-44 group inline-flex items-center gap-1.5 text-sm font-semibold text-link'],
    ["components/home/TechStackSection.tsx", 'tap-44 group inline-flex shrink-0 items-center gap-1.5 pb-1 text-sm font-semibold text-link'],
  ]) {
    assert.ok(readProjectFile(file).includes(marker), `${file} 的头部链接应带 tap-44`);
  }
});

test("触控面积：内页返回链接真实命中高度 ≥44px（py-3 + -my-3 布局补偿）", () => {
  const header = readProjectFile("components/layout/PageHeader.tsx");
  assert.match(header, /group -my-3 inline-flex items-center gap-1\.5 py-3 text-sm font-medium/);
});

/* ============================ 三、focus-visible 与键盘 ============================ */

test("焦点可见性：全局 :focus-visible 深蓝焦点环（≥3:1），核心交互组件各带清晰焦点态", () => {
  const css = readProjectFile("app/globals.css");
  const focusRule = css.match(/:focus-visible\s*\{([\s\S]*?)\}/);
  assert.ok(focusRule, "globals.css 应有全局 :focus-visible 规则");
  // 焦点环用加深档 --color-focus-ring（#1668C4 对天空/玻璃底 ≥3:1，
  // 品牌蓝 #269DFF 仅 2.66:1 不达标）；数值级校验见 contrast.test.mjs
  assert.match(focusRule[1], /outline:\s*2px solid var\(--color-focus-ring\)/);
  assert.match(focusRule[1], /outline-offset:\s*2px/);
  assert.match(css, /--color-focus-ring:\s*#1668C4/i);

  // 组件级焦点态（与全局环同风格，同用加深档）
  assert.match(css, /\.hero-primary-btn:focus-visible/);
  assert.match(css, /\.hero-ghost-btn:focus-visible/);
  const heroBtnFocus = css.match(/\.hero-primary-btn:focus-visible\s*\{([\s\S]*?)\}/);
  assert.match(heroBtnFocus[1], /var\(--color-focus-ring\)/);
  const ghostBtnFocus = css.match(/\.hero-ghost-btn:focus-visible\s*\{([\s\S]*?)\}/);
  assert.match(ghostBtnFocus[1], /var\(--color-focus-ring\)/);
  for (const [file, marker] of [
    ["components/ui/GlassButton.tsx", "focus-visible:outline-2"],
    ["components/layout/Navbar.tsx", "focus-visible:outline-2"],
    ["components/projects/ProjectCard.tsx", "focus-visible:outline-2"],
    ["components/home/ContactSection.tsx", "focus-visible:outline-2"],
  ]) {
    assert.ok(readProjectFile(file).includes(marker), `${file} 应有组件级焦点态`);
  }
  for (const file of [
    "components/ui/GlassButton.tsx",
    "components/layout/Navbar.tsx",
    "components/projects/ProjectCard.tsx",
  ]) {
    const src = readProjectFile(file);
    assert.match(src, /focus-visible:outline-focus-ring/, `${file} 焦点环应使用加深档`);
    assert.doesNotMatch(src, /focus-visible:outline-blue/, `${file} 不得再用品牌蓝焦点环`);
  }
});

test("键盘可操作：跳转链接 + 主内容锚点 + 移动菜单 Esc 关闭 / 关闭态 inert", () => {
  const layout = readProjectFile("app/layout.tsx");
  assert.match(layout, /href="#main"/, "应提供「跳到主内容」跳转链接");
  assert.match(layout, /sr-only focus:not-sr-only/, "跳转链接应仅键盘聚焦时可见");
  assert.match(layout, /<main id="main"/, "主内容应有 main 锚点");

  const navbar = readProjectFile("components/layout/Navbar.tsx");
  assert.match(navbar, /event\.key === "Escape"/, "Esc 应能关闭移动菜单");
  assert.match(navbar, /inert=\{!menuOpen\}/, "关闭态菜单应 inert 不可聚焦");
  assert.match(navbar, /aria-expanded=\{menuOpen\}/);
  assert.match(navbar, /aria-controls="mobile-nav-menu"/);
});

/* ============================ 四、对比度 ============================ */

test("对比度：玻璃面板上的正文一律使用深蓝令牌（text-primary / text-secondary）", () => {
  const files = [
    "components/home/FeaturedProjects.tsx",
    "components/home/AboutSection.tsx",
    "components/home/JourneySection.tsx",
    "components/home/TechStackSection.tsx",
    "components/home/LatestNotes.tsx",
    "components/projects/ProjectCard.tsx",
    "components/layout/Footer.tsx",
  ];
  for (const file of files) {
    const src = readProjectFile(file);
    assert.ok(src.includes("text-text-primary"), `${file} 正文标题应使用深蓝 --color-text-primary`);
    assert.ok(src.includes("text-text-secondary"), `${file} 正文说明应使用深蓝 --color-text-secondary`);
    // 禁止玻璃底上出现白色正文；text-white/N 仅允许出现在深色小徽标底上
    // （如 LatestNotes「概念视觉」图注 chips：bg-[#0B1B38]/55 深底白字，对比充足）
    assert.doesNotMatch(src, /(?<![\w/-])text-white(?![\w/-])/,
      `${file} 玻璃面板上不得出现白色正文`);
  }
});

test("对比度：深色夜景版块使用浅色文字，与玻璃版块互不混用", () => {
  const contact = readProjectFile("components/home/ContactSection.tsx");
  assert.match(contact, /text-white/, "夜景深色底上标题应为白色");
  assert.match(contact, /text-\[#C6DAF6\]/, "夜景正文应为浅冰蓝");
  // 玻璃版块正文不使用夜景浅色
  const about = readProjectFile("components/home/AboutSection.tsx");
  assert.ok(!about.includes("text-[#C6DAF6]"), "玻璃版块不得借用夜景浅色正文");
});

/* ============================ 五、性能 ============================ */

test("性能：Hero 场景图 priority + fill 预留空间（46svh 横幅 / lg 右栏），无布局跳动", () => {
  const scene = readProjectFile("components/home/HeroScene.tsx");
  assert.match(scene, /<Image\s*\n\s*src="\/images\/hero-clean\.png"/);
  assert.match(scene, /fill/);
  assert.match(scene, /priority/);
  assert.match(scene, /sizes="\(min-width: 1024px\) 64vw, 100vw"/);
  // 预留空间：场景容器为绝对定位的固定视口高度（图片加载不改变文档流）
  assert.match(scene, /pointer-events-none absolute inset-x-0 top-0 z-0 h-\[46svh\]/);
});

test("性能：非首屏图片一律懒加载（项目卡默认不 priority，关于我插画无 priority）", () => {
  const card = readProjectFile("components/projects/ProjectCard.tsx");
  assert.match(card, /priority = false/, "项目卡 priority 应默认关闭");

  const about = readProjectFile("components/home/AboutSection.tsx");
  const imageBlock = about.match(/<Image[\s\S]*?\/>/);
  assert.ok(imageBlock, "AboutSection 应有插画 Image");
  assert.doesNotMatch(imageBlock[0], /priority/, "关于我插画不应 priority（懒加载）");
});

test("性能：移动端持续运行的 CSS 动画减量（轨道第二条隐藏 + 光点减半）", () => {
  const scene = readProjectFile("components/home/HeroScene.tsx");

  // 第二条轨道环仅 lg+ 渲染
  assert.match(scene, /hero-orbit-tilt-b hidden lg:block/);

  // 光点：8 颗中 ≥4 颗标记 desktopOnly（移动端隐藏）
  const particleDefs = scene.match(/\{ x: "[^"]+", y: "[^"]+", s: "[^"]+", d: "[^"]+", dl: "[^"]+"(?:, desktopOnly: true)? \}/g) ?? [];
  assert.equal(particleDefs.length, 8, "光点总数应为 8");
  const desktopOnly = particleDefs.filter((def) => def.includes("desktopOnly: true"));
  assert.ok(desktopOnly.length >= 4, `移动端至少隐藏 4 颗光点，实际 ${desktopOnly.length}`);
  assert.match(scene, /particle\.desktopOnly && "hidden sm:block"/);

  // 移动端持续运行动画计数：光点 4 + 轨道 1 + 光晕 1 + 悬浮 1 + 脉冲 1 + 圆钮 1 = ≤9
  const mobileRunning = 8 - desktopOnly.length + 1 + 1 + 1 + 1 + 1;
  assert.ok(mobileRunning <= 9, `移动端持续动画应 ≤9 个，实际 ${mobileRunning}`);
});

test("性能：Hero 离屏暂停 + will-change 仅精确指针设备常驻", () => {
  const hero = readProjectFile("components/home/Hero.tsx");
  assert.match(hero, /IntersectionObserver/, "滚出视口应暂停装饰动画");
  assert.match(hero, /data-hero-active/);

  const css = readProjectFile("app/globals.css");
  const mediaBlock = css.match(/@media \(hover: hover\) and \(pointer: fine\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(mediaBlock, "应存在 (hover:hover) and (pointer:fine) 媒体查询块");
  assert.match(mediaBlock[1], /will-change:\s*transform/,
    "will-change 应收进精确指针媒体查询");

  // reduced-motion 下 will-change 释放
  const reducedIndex = css.indexOf("@media (prefers-reduced-motion: reduce)");
  const reducedBlock = css.slice(reducedIndex);
  assert.match(reducedBlock, /will-change:\s*auto/);
});

test("性能：触屏设备撤下 background-attachment: fixed（滚动重绘开销）", () => {
  const css = readProjectFile("app/globals.css");
  const touchBlock = css.match(/@media \(hover: none\), \(pointer: coarse\)\s*\{\s*body\s*\{([\s\S]*?)\}/);
  assert.ok(touchBlock, "应有触屏媒体查询覆盖 body 背景");
  assert.match(touchBlock[1], /background-attachment:\s*scroll/);
});

test("性能与可访问性：prefers-reduced-motion 全站兜底（动画 / 过渡 / 平滑滚动瞬时化）", () => {
  const css = readProjectFile("app/globals.css");
  const reducedIndex = css.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(reducedIndex !== -1, "应有 prefers-reduced-motion 块");
  const reducedBlock = css.slice(reducedIndex);

  // 全局兜底规则
  assert.match(reducedBlock, /\*,\s*\*::before,\s*\*::after\s*\{[\s\S]*?animation-duration:\s*0\.01ms !important/);
  assert.match(reducedBlock, /transition-duration:\s*0\.01ms !important/);
  assert.match(reducedBlock, /animation-iteration-count:\s*1 !important/);
  assert.match(reducedBlock, /scroll-behavior:\s*auto !important/);

  // Hero 专用降级仍在（reveal 直接可见，装饰动画静止）
  assert.match(reducedBlock, /\.hero-reveal\s*\{[^}]*animation:\s*none/);
  for (const cls of [".hero-float", ".hero-glow", ".hero-orbit", ".hero-particle", ".hero-knob"]) {
    assert.ok(reducedBlock.includes(cls), `reduced-motion 块应静止 ${cls}`);
  }
});
