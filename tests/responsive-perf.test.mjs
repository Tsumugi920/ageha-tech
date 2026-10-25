/**
 * 响应式与性能打磨测试（node:test）：
 * 覆盖五个承诺维度 —— 断点布局（320/390/768/1024/1440 不横溢的静态前提）、
 * ≥44px 触控面积、focus-visible 焦点环、玻璃面板对比度令牌、
 * 性能（图片加载策略 / 性能档位表 / 输入监听清理 / reduced-motion 全覆盖）。
 *
 * 【迁移记录】Hero.tsx / HeroScene.tsx / FeaturedProjects.tsx / LatestNotes.tsx
 * 四文件已随首页 3D 化退役（蓝图 §14.0），其响应式断言（评审遗留意见：原
 * 14 处）随组件退役剥离；首页的视口契约改守 #world-root 沉浸层与
 * lib/world/performance.ts 档位表。浏览器实测由构建流程另行执行。
 * 运行方式：npm test（即 node --test "tests/*.test.mjs"）
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { TIER_PARAMS, MOBILE_MODIFIERS } from "../lib/world/performance.ts";
import { INTERACTION } from "../lib/world/constants.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

/* ============================ 一、断点布局 ============================ */

test("断点布局：项目卡片移动单列（显式 grid-cols-1 防隐式 auto 轨道被标签行撑宽）、md 两列防 1024 窄卡截断、xl 恢复三等列（/projects 列表与世界降级页一致）", () => {
  for (const file of [
    "app/projects/page.tsx",
    "components/world/ui/FallbackProjects.tsx",
  ]) {
    const src = readProjectFile(file);
    assert.match(src, /grid list-none grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3/,
      `${file} 卡片网格应为显式单列（minmax(0,1fr)）+ md:grid-cols-2 + xl:grid-cols-3（md 起间距 32px）`);
  }
});

test("断点布局：世界沉浸层全视口铺满（fixed inset-0），页面不滚动、页脚隐藏", () => {
  const css = readProjectFile("app/globals.css");
  const rootRule = css.match(/\.world-root\s*\{([\s\S]*?)\}/);
  assert.ok(rootRule, "globals.css 应有 .world-root 规则");
  assert.match(rootRule[1], /position:\s*fixed/);
  assert.match(rootRule[1], /inset:\s*0/);
  assert.match(rootRule[1], /overflow:\s*hidden/);

  // 首页沉浸：body:has(#world-root) 禁滚动 + Footer 隐藏（零 JS、其它路由零影响）
  const immersive = css.match(/body:has\(#world-root\)\s*\{([\s\S]*?)\}/);
  assert.ok(immersive, "应有 body:has(#world-root) 沉浸规则");
  assert.match(immersive[1], /overflow:\s*hidden/);
  assert.match(css, /body:has\(#world-root\)[^{]*footer\s*\{[^}]*display:\s*none/);

  // 画布触摸拖拽不被浏览器手势拦截（虚拟摇杆 / 相机观察）
  const canvasRule = css.match(/\.world-canvas\s*\{([\s\S]*?)\}/);
  assert.ok(canvasRule);
  assert.match(canvasRule[1], /touch-action:\s*none/);
  const joystickRule = css.match(/\.world-joystick\s*\{([\s\S]*?)\}/);
  assert.ok(joystickRule);
  assert.match(joystickRule[1], /touch-action:\s*none/);
});

test("宽屏排版：项目卡标题 24px / 描述 15px / 四行兜底 / xl 内边距 28px（1840 容器下卡宽 ≈565px）", () => {
  const card = readProjectFile("components/projects/ProjectCard.tsx");
  assert.match(
    card,
    /font-display text-xl font-bold tracking-tight text-text-primary md:text-2xl/,
    "项目卡标题应为 20px → md 24px（宽屏作品展示级标题）",
  );
  assert.match(
    card,
    /line-clamp-4 text-sm leading-relaxed text-text-secondary md:text-\[15px\]/,
    "项目卡描述应为 14px → md 15px，四行兜底",
  );
  // 封面仍是卡片最主要视觉区域：统一 3:2 比例不因容器放宽而改变
  assert.match(card, /aspect-\[3\/2\]/);
  // 卡片内边距随容器放宽加大（p-5 → sm:p-6 → xl:p-7），不无限拉伸
  assert.match(card, /p-5 transition-\[transform,box-shadow,border-color\] duration-300 hover:border-\[#7FB2E6\] sm:p-6 xl:p-7/);
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

test("断点布局：全站统一主容器四档宽度阶梯（1360 → 1440 → 1600 → 1840px，主设计目标 2560×1440）", () => {
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
  // globals.css 定义四档容器令牌（85/90/100/115rem）
  const css = readProjectFile("app/globals.css");
  assert.match(css, /--container-site:\s*85rem/);
  assert.match(css, /--container-site-wide:\s*90rem/);
  assert.match(css, /--container-site-lg:\s*100rem/);
  assert.match(css, /--container-site-max:\s*115rem/);

  // --container-max 阶梯：默认 site，≥1600 wide、≥1920 lg、≥2560 max
  const rootRule = css.match(/:root\s*\{([\s\S]*?)\}/);
  assert.ok(rootRule, "应有 :root 规则");
  assert.match(rootRule[1], /--container-max:\s*var\(--container-site\)/);
  const tier = (mq, token) =>
    new RegExp(
      `@media \\(min-width: ${mq}\\)\\s*\\{\\s*:root\\s*\\{[\\s\\S]*?--container-max:\\s*var\\(--container-${token}\\)`,
    );
  assert.match(css, tier("1600px", "site-wide"), "≥1600px 档应切到 90rem（1440px）");
  assert.match(css, tier("1920px", "site-lg"), "≥1920px 档应切到 100rem（1600px）");
  assert.match(css, tier("2560px", "site-max"), "≥2560px 档应切到 115rem（1840px）");

  // .site-container 与 .site-shell 都读阶梯变量：任何视口下同宽同缘
  const container = css.match(/\.site-container\s*\{([\s\S]*?)\}/);
  assert.ok(container, "globals.css 应有 .site-container 组件类");
  assert.match(container[1], /max-width:\s*var\(--container-max\)/);
  assert.match(container[1], /padding-inline:\s*var\(--site-gutter\)/);
  const shell = css.match(/\.site-shell\s*\{([\s\S]*?)\}/);
  assert.ok(shell, "globals.css 应有 .site-shell 无内边距外壳类");
  assert.match(shell[1], /max-width:\s*var\(--container-max\)/);
  assert.match(shell[1], /margin-inline:\s*auto/);

  // 导航栏用 site-shell（随阶梯放宽并与正文容器同缘）
  const navbar = readProjectFile("components/layout/Navbar.tsx");
  assert.match(navbar, /glass-panel site-shell flex items-center justify-between/,
    "导航栏应使用 site-shell 随阶梯放宽并与正文容器同缘");
});

test("全站节奏：保留版块纵向间距以 64–88px 为基线按密度微调（py-16 / py-20 / lg:py-22）", () => {
  // 保留版块（FeaturedProjects / LatestNotes 已退役）+ 内页容器的纵向节奏类
  const sectionRhythms = [
    ["components/home/AboutSection.tsx", /site-container scroll-mt-24 py-20/],
    ["components/home/TechStackSection.tsx", /site-container scroll-mt-24 py-20/],
    ["components/home/JourneySection.tsx", /site-container scroll-mt-24 py-16 lg:hidden/],
    ["components/home/ContactSection.tsx", /site-container py-20 lg:py-22/],
  ];
  for (const [file, pattern] of sectionRhythms) {
    assert.match(
      readProjectFile(file),
      pattern,
      `${file} 版块纵向节奏应落在 64–88px 基线`,
    );
  }
  // 内页统一页头下沿 56px（pt-14，导航让位非版块间距）+ 尾部 80px（pb-20）
  for (const file of [
    "app/projects/page.tsx",
    "app/articles/page.tsx",
    "app/projects/[slug]/page.tsx",
  ]) {
    assert.match(readProjectFile(file), /site-container pb-20 pt-14/);
  }
  assert.match(readProjectFile("app/tech/page.tsx"), /site-container pt-14/);
  assert.match(readProjectFile("app/tech/page.tsx"), /site-container pb-20/);
});

test("全站节奏：卡片内边距统一 20–28px（p-5 / p-6 / sm:p-6），无 p-3 / p-4 收紧卡", () => {
  for (const [file, pattern] of [
    ["components/projects/ProjectCard.tsx", /flex h-full flex-col border-\[#9EC4EC\] p-5 transition[\s\S]*?sm:p-6/],
    ["app/articles/page.tsx", /glass-card relative flex h-full flex-col rounded-2xl p-5/],
    ["components/home/TechStackSection.tsx", /glass-card rounded-2xl p-6/],
    ["components/home/JourneySection.tsx", /rounded-2xl border border-glass-border bg-glass-strong p-5 shadow-card backdrop-blur-md sm:p-6/],
    ["components/home/AboutSection.tsx", /rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-sm/],
  ]) {
    assert.match(
      readProjectFile(file),
      pattern,
      `${file} 卡片内边距应为 20–28px（p-5 / p-6）`,
    );
  }
  // 全站内容卡不再出现 p-3 / p-4 紧凑内边距（横幅条 / 徽标不受此约束）
  const cardFiles = [
    "components/projects/ProjectCard.tsx",
    "app/articles/page.tsx",
  ];
  for (const file of cardFiles) {
    const src = readProjectFile(file);
    assert.doesNotMatch(src, /glass-card[^\n]*\bp-[34]\b/, `${file} 玻璃卡不应再用 p-3 / p-4`);
    assert.doesNotMatch(src, /GlassCard[^\n]*\bp-[34]\b/, `${file} GlassCard 不应再用 p-3 / p-4`);
  }
});

test("可读性：卡片正文 ≥14px（text-sm 起），技术标签 13px 可辨认，无 12px 及以下正文", () => {
  for (const file of ["app/articles/page.tsx"]) {
    const src = readProjectFile(file);
    assert.match(src, /mt-2 text-sm font-semibold leading-snug text-text-primary/, `${file} 卡片标题应为 14px`);
    assert.match(src, /mt-1\.5 line-clamp-2 text-sm leading-relaxed text-text-secondary/, `${file} 卡片摘要应为 14px`);
    assert.doesNotMatch(src, /text-\[13\.5px\]/, `${file} 不应残留 13.5px 正文`);
    assert.doesNotMatch(src, /line-clamp-2 text-xs/, `${file} 卡片摘要不应为 12px`);
  }
  // 技术标签：项目卡与详情页标签胶囊 13px 深墨（可辨认）
  for (const file of ["components/projects/ProjectCard.tsx", "app/projects/[slug]/page.tsx"]) {
    assert.match(
      readProjectFile(file),
      /bg-\[#C8D7EB\]\/40 px-3 py-1 text-\[13px\] font-medium text-text-primary/,
      `${file} 技术标签应为 13px 深墨`,
    );
  }
  // 技术栈矩阵条目名 14px 正文色 + 44px 图标底板
  assert.match(
    readProjectFile("components/home/TechStackSection.tsx"),
    /text-sm leading-tight text-text-primary/,
  );
  assert.match(
    readProjectFile("components/home/TechStackSection.tsx"),
    /size-11 shrink-0 items-center justify-center rounded-xl/,
    "技术图标底板应为 44px",
  );
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

test("触控面积：玻璃按钮基类 min-h-11，项目卡「查看详情」入口胶囊 ≥44px 高", () => {
  const button = readProjectFile("components/ui/GlassButton.tsx");
  assert.match(button, /inline-flex min-h-11 cursor-pointer/,
    "GlassButton 基类应保证 ≥44px 高度");

  const card = readProjectFile("components/projects/ProjectCard.tsx");
  assert.match(
    card,
    /group\/arrow inline-flex shrink-0 items-center gap-2 rounded-full border border-white\/70 bg-white\/60 py-1 pl-3\.5 pr-1/,
    "项目卡入口胶囊类串应就位",
  );
  assert.match(card, /查看详情/, "入口应有可见的「查看详情」文案");
  assert.match(
    card,
    /grid size-9 place-items-center rounded-full bg-linear-to-br from-cyan to-blue/,
    "入口圆钮应 36px（加胶囊内边距合计 ≥44px）",
  );
  assert.match(card, /focus-visible:outline-focus-ring/, "入口焦点环应使用加深档");
});

test("触控面积：世界 HUD 按钮与提示条 ≥44px 高（min-height 2.75rem）", () => {
  const css = readProjectFile("app/globals.css");
  for (const cls of [
    "world-hud__prompt-btn",
    "world-hud__hint-dot",
    "world-hud__quick-item",
    "world-hud__quick-mini",
    "world-toast__primary",
    "world-toast__ghost",
    "world-panel__close",
    "world-panel__primary",
    "world-panel__ghost",
    "world-detail__link",
  ]) {
    const rule = css.match(new RegExp(`\\.${cls}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(rule, `globals.css 应有 .${cls} 规则`);
    assert.match(
      rule[1],
      /min-height:\s*2\.75rem/,
      `.${cls} 触控高度应 ≥44px`,
    );
  }
  // 虚拟摇杆 96px 玻璃圆盘（§6.3）
  const joystick = css.match(/\.world-joystick\s*\{([\s\S]*?)\}/);
  assert.ok(joystick);
  assert.match(joystick[1], /width:\s*6rem/);
  assert.match(joystick[1], /height:\s*6rem/);
});

test("触控面积：联系按钮 ≥44px 高（内页版块保留项）", () => {
  const contact = readProjectFile("components/home/ContactSection.tsx");
  assert.match(contact, /px-6 py-3 text-sm font-semibold text-white/,
    "联系我按钮应 ≥44px 高");
});

test("触控面积：小号文本链接以 tap-44 外扩命中区（品牌 / 胶囊导航 / 查看更多）", () => {
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
  // 焦点环用加深档 --color-focus-ring（#1668C4 对天空/玻璃底 ≥3:1）
  assert.match(focusRule[1], /outline:\s*2px solid var\(--color-focus-ring\)/);
  assert.match(focusRule[1], /outline-offset:\s*2px/);
  assert.match(css, /--color-focus-ring:\s*#1668C4/i);

  // 组件级焦点态（与全局环同风格，同用加深档）
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

test("键盘可操作：世界控制键全键盘可达（WASD/方向键/E/R），窗口失焦清空按键态", () => {
  const controller = readProjectFile("components/world/systems/usePlayerController.ts");
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyE", "KeyR", "ShiftLeft"]) {
    assert.ok(controller.includes(`"${code}"`), `控制器应处理 ${code}`);
  }
  assert.match(controller, /addEventListener\("keydown"/, "应监听 keydown");
  assert.match(controller, /addEventListener\("keyup"/, "应监听 keyup");
  assert.match(controller, /addEventListener\("blur"/, "窗口失焦应清空按键态");
  assert.match(controller, /removeEventListener/, "卸载应注销全部监听");
});

/* ==================== 阶段 2 交互系统：键盘 / 焦点 / 传送 / 拖拽守卫 ==================== */

test("世界快捷键：M 导航 / H·? 说明 / Esc 关闭 / 1·2·3 传送，面板焦点内让位", () => {
  const shortcuts = readProjectFile("components/world/systems/useWorldShortcuts.ts");
  for (const code of ["KeyM", "KeyH", "Escape", "Digit1", "Digit2", "Digit3"]) {
    assert.ok(shortcuts.includes(`"${code}"`), `快捷键应处理 ${code}`);
  }
  assert.match(shortcuts, /event\.key === "\?"/, "? 应与 H 同义打开操作说明");
  // 焦点在面板内（data-world-panel）时快捷键让位（Tab/Enter 归面板语义）
  assert.match(
    shortcuts,
    /closest\("\[data-world-panel\]"\)/,
    "面板内焦点应豁免全局快捷键",
  );
  assert.match(shortcuts, /removeEventListener/, "卸载应注销监听");
  // WorldShell 就绪后启用快捷键
  const shell = readProjectFile("components/world/WorldShell.tsx");
  assert.match(
    shell,
    /useWorldShortcuts\(phase === "ready"\)/,
    "世界就绪后才启用快捷键",
  );
});

test("面板键盘可达：对话框语义 + 焦点陷阱 + 焦点归还 + Esc / 点空白关闭", () => {
  const a11y = readProjectFile("components/world/ui/usePanelA11y.ts");
  assert.match(a11y, /key === "Escape"/, "Esc 应关闭面板");
  assert.match(a11y, /key === "Tab"/, "应处理 Tab 循环（焦点陷阱）");
  assert.match(a11y, /openerRef/, "关闭后应把焦点还给打开者");
  assert.match(a11y, /removeEventListener/, "卸载应注销监听");
  // 点击场景空白关闭：canvas 上的非拖拽 pointerup（3D 交互体点击有守卫标记）
  assert.match(a11y, /closest\("canvas"\)/, "应识别画布空白点击");
  assert.match(a11y, /pointerDragged/, "拖拽观察不应误关面板");

  for (const file of [
    "components/world/ui/ProjectDetailPanel.tsx",
    "components/world/ui/WorldNavPanel.tsx",
    "components/world/ui/HelpPanel.tsx",
  ]) {
    const src = readProjectFile(file);
    assert.match(src, /role="dialog"/, `${file} 应有对话框语义`);
    assert.match(src, /aria-modal="true"/, `${file} 应声明模态`);
    assert.match(src, /aria-hidden=\{!open\}/, `${file} 关闭态应 aria-hidden`);
    assert.match(src, /inert=\{!open\}/, `${file} 关闭态应 inert 不可聚焦`);
  }
});

test("拖拽守卫：观察拖拽不触发场景交互 / 面板关闭，3D 点击直达详情", () => {
  const camera = readProjectFile("components/world/systems/FollowCamera.tsx");
  assert.match(camera, /pointerDragged/, "相机拖拽应累计并写共享守卫标志");
  assert.match(camera, /DRAG_THRESHOLD/, "应有判定阈值");

  const isle = readProjectFile("components/world/objects/ProjectIsle.tsx");
  assert.match(isle, /inputState\.pointerDragged/, "交互体点击前应查拖拽守卫");
  assert.match(isle, /onPointerOver/, "交互体应有悬停反馈");
  assert.match(isle, /onClick/, "交互体应可点击打开详情");
  assert.match(isle, /openDetail\(isle\.slug\)/, "点击应打开场景内详情面板");
  assert.match(isle, /suppressSceneClose/, "3D 点击应防误关守卫（换开面板不秒关）");

  // 高亮与名牌反馈：靠近 <6 / 悬停 → cyan 光圈脉冲；<10 名牌淡入
  assert.match(isle, /ringRef/, "应有高亮光圈");
  assert.match(isle, /nameplateDistance/, "名牌透明度应随距离");
  // 阶段 3 起脉冲周期收口到 MOTION 统一节奏表（值断言在 world-assets
  // 的 worldMotion 检查里：pulsePeriod 1.6 与 DOM 层同拍）
  assert.match(isle, /MOTION\.pulsePeriod/, "光圈脉冲周期应取 MOTION.pulsePeriod（1.6s，§8 反馈一致性）");
});

test("传送系统：1.2s 贝塞尔运镜 + 输入锁定 + 弹簧对齐 + reduced-motion 降级", () => {
  const teleport = readProjectFile("components/world/systems/TeleportSystem.tsx");
  assert.match(teleport, /teleportTarget/, "应消费 DOM 层传送请求");
  assert.match(teleport, /teleportActive/, "飞行期间应锁定控制器输入");
  assert.match(teleport, /reducedMotion \? 0\.3 : 1\.2/, "reduced-motion 应 300ms 直线飞行");
  assert.match(teleport, /lift/, "正常档应有抬升弧线（§7 传送运镜）");
  assert.match(teleport, /springY/, "落地应对齐贴地弹簧（多层地形防跨层吸附）");

  // 控制器让位：传送期间跳过运动 / 贴地
  const controller = readProjectFile("components/world/systems/usePlayerController.ts");
  assert.match(
    controller,
    /inputState\.teleportActive/,
    "控制器应识别传送锁并让位",
  );
  // 快捷键 1/2/3 → 传送目标来自 PROJECT_ISLES（数据单源）
  const shortcuts = readProjectFile("components/world/systems/useWorldShortcuts.ts");
  assert.match(shortcuts, /PROJECT_ISLES\[index\]/, "数字键传送应查 PROJECT_ISLES");
});

test("世界面板动画与降级：280ms 同曲线滑入滑出，reduced-motion 瞬时完成", () => {
  const css = readProjectFile("app/globals.css");
  const panelRule = css.match(/\.world-panel\s*\{([\s\S]*?)\}/);
  assert.ok(panelRule, "应有 .world-panel 基础规则");
  assert.match(
    panelRule[1],
    /transform 0\.28s cubic-bezier\(0\.22, 1, 0\.36, 1\)/,
    "面板过渡应为 280ms 同曲线（§8 反馈一致性）",
  );
  assert.match(panelRule[1], /visibility 0s linear 0\.28s/, "滑出完成后才隐藏");
  const openRule = css.match(/\.world-panel--open\s*\{([\s\S]*?)\}/);
  assert.ok(openRule, "应有打开态规则");
  // 移动端底部抽屉形态（§13.4）
  const mobileBlock = css.slice(css.indexOf("@media (max-width: 640px)"));
  assert.match(
    mobileBlock,
    /\.world-panel\s*\{[\s\S]*?max-height:\s*76vh/,
    "移动端面板应为底部抽屉（≤76vh）",
  );
  // reduced-motion：全局兜底瞬时化已覆盖面板（hero/responsive 双断言在此复核）
  const reducedBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reducedBlock, /\.world-panel\s*\{[^}]*transition:\s*none/);
});

test("世界面板顶部避让：× 关闭键不被 fixed Navbar 遮挡（真实点击回归）", () => {
  const css = readProjectFile("app/globals.css");
  // 根因：面板在 .world-root(z-index:0) 层叠上下文内，压不过文档流 sticky z-50
  // 的 Navbar，只能物理避让。实测导航底边 ≈82px，避让线取 5.75rem(92px)。
  const rootRule = css.match(/\.world-root\s*\{([^}]*)\}/);
  assert.ok(rootRule, "应有 .world-root 规则");
  assert.match(
    rootRule[1],
    /--world-nav-clear:\s*5\.75rem/,
    ".world-root 应定义导航避让令牌 --world-nav-clear: 5.75rem（>导航实测底边 82px）",
  );

  const panelRule = css.match(/\.world-panel\s*\{([\s\S]*?)\}/);
  assert.ok(panelRule, "应有 .world-panel 基础规则");
  assert.match(
    panelRule[1],
    /top:\s*var\(--world-nav-clear,\s*5\.75rem\)/,
    "面板顶边应下移到避让线，× 关闭键落在导航之下可被真实点击（不能是 top:0）",
  );

  // 品牌角标同一避让线（同一令牌单一来源，视觉顶线一致）
  const dockRule = css.match(/\.world-brand--dock\s*\{([^}]*)\}/);
  assert.ok(dockRule, "应有 .world-brand--dock 规则");
  assert.match(
    dockRule[1],
    /top:\s*var\(--world-nav-clear,\s*5\.75rem\)/,
    "品牌角标应消费同一避让令牌",
  );

  // 移动端底部抽屉不受影响：top 归位 auto（由 bottom 撑起）
  const mobileBlock = css.slice(css.indexOf("@media (max-width: 640px)"));
  assert.match(
    mobileBlock,
    /\.world-panel\s*\{[\s\S]*?top:\s*auto/,
    "移动端底部抽屉应保持 top:auto，避让线只作用于桌面右侧滑入形态",
  );
});

/* ============================ 四、对比度 ============================ */

test("对比度：玻璃面板上的正文一律使用深蓝令牌（text-primary / text-secondary）", () => {
  const files = [
    "components/home/AboutSection.tsx",
    "components/home/JourneySection.tsx",
    "components/home/TechStackSection.tsx",
    "components/projects/ProjectCard.tsx",
    "components/layout/Footer.tsx",
  ];
  for (const file of files) {
    const src = readProjectFile(file);
    assert.ok(src.includes("text-text-primary"), `${file} 正文标题应使用深蓝 --color-text-primary`);
    assert.ok(src.includes("text-text-secondary"), `${file} 正文说明应使用深蓝 --color-text-secondary`);
    assert.doesNotMatch(src, /(?<![\w/-])text-white(?![\w/-])/,
      `${file} 玻璃面板上不得出现白色正文`);
  }
});

test("对比度：联系区暮光天幕 + 浅玻璃幕带使用深墨正文，text-white 仅限 CTA", () => {
  const contact = readProjectFile("components/home/ContactSection.tsx");
  assert.match(contact, /bg-glass-strong/, "联系区内容应收进实底浅玻璃幕带");
  assert.match(contact, /text-text-primary/, "暮光天幕上的浅玻璃幕带正文应为深墨");
  assert.doesNotMatch(contact, /text-\[#C6DAF6\]/, "夜景浅蓝正文随深色大板一并移除");
  const whiteText = contact.match(/(?<![\w/-])text-white(?![\w/-])/g) ?? [];
  assert.equal(whiteText.length, 1, "text-white 只应出现在 CTA 胶囊一处");
  assert.match(contact, /px-6 py-3 text-sm font-semibold text-white/);
  const about = readProjectFile("components/home/AboutSection.tsx");
  assert.ok(!about.includes("text-[#C6DAF6]"), "玻璃版块不得借用夜景浅色正文");
});

/* ============================ 五、性能 ============================ */

test("性能档位表（lib/world/performance.ts）：三档齐全，DPR/阴影/粒子/远景逐档递减", () => {
  const tiers = Object.values(TIER_PARAMS);
  assert.equal(tiers.length, 3, "应有高/中/低三档");
  assert.deepEqual(
    tiers.map((tier) => tier.tier).sort(),
    ["high", "low", "medium"],
  );
  const high = TIER_PARAMS.high;
  const medium = TIER_PARAMS.medium;
  const low = TIER_PARAMS.low;
  assert.ok(high.dprMax <= 2, "DPR 上限不得超过 2");
  assert.ok(high.dprMax > medium.dprMax && medium.dprMax > low.dprMax, "DPR 应逐档递减");
  assert.equal(high.shadows, 2048, "高档应开 2048 阴影");
  assert.equal(medium.shadows, false);
  assert.equal(low.shadows, false);
  assert.ok(high.particleBudget > medium.particleBudget && medium.particleBudget > low.particleBudget);
  assert.ok(high.distantIsles > medium.distantIsles && medium.distantIsles > low.distantIsles);
  assert.ok(high.clouds > medium.clouds && medium.clouds > low.clouds);
  // transmission 名额管控（§3.2：全场景 ≤3 mesh，性能档降级为 opacity）
  assert.ok(high.transmissionBudget <= 3);
  assert.equal(low.transmissionBudget, 0);
  // 移动端补偿（§6.3）
  assert.equal(MOBILE_MODIFIERS.defaultTier, "medium");
  assert.ok(MOBILE_MODIFIERS.speedScale < 1, "移动端速度上限应打折");
});

test("性能：WorldCanvas 初始档限 DPR 与阴影 + QualityProvider 动态接管（SSR 安全）", () => {
  const canvas = readProjectFile("components/world/WorldCanvas.tsx");
  assert.match(canvas, /"use client"/);
  // 初始档（设备形态静态选档）声明 Canvas 上限；此后 AdaptiveQuality 按帧时间接管
  assert.match(canvas, /dpr=\{\[1, initialTier\.dprMax\]\}/, "初始 DPR 应限制在 [1, 初始档上限]");
  assert.match(
    canvas,
    /shadows=\{initialTier\.shadows !== false\}/,
    "初始阴影应随初始档开关（three 0.186 已移除 PCFSoft，用默认 PCF）",
  );
  assert.match(canvas, /<QualityProvider isMobileLike=\{isMobileLike\}>/, "场景应包裹 QualityProvider");
  for (const system of ["AdaptiveQuality", "ShadowToggle", "ContextGuard"]) {
    assert.ok(canvas.includes(`<${system} />`), `场景应挂载 ${system}`);
  }
  const shell = readProjectFile("components/world/WorldShell.tsx");
  assert.match(shell, /ssr: false/, "3D Canvas 必须 ssr:false 装载");
  // ResizeObserver 兜底：原生失效的 WebView 下注入测量 polyfill（§10）
  assert.match(
    shell,
    /probeResizeObserverBroken/,
    "WorldShell 应探测 ResizeObserver 可用性",
  );
  assert.match(
    canvas,
    /resize=\{resizePolyfill \? \{ polyfill: resizePolyfill \} : undefined\}/,
    "Canvas 应支持注入测量 polyfill",
  );
});

test("性能：AdaptiveQuality 帧率自适应（120 帧滑动窗口，22ms·2s 降档 / 14ms·8s 升档，最多升 2 次）", () => {
  const source = readProjectFile("components/world/systems/AdaptiveQuality.tsx");
  // 判定参数数据化（§12.2 逐项锁定，防调参回归）
  for (const marker of [
    "windowFrames: 120",
    "slowAvgMs: 22",
    "slowHoldSeconds: 2",
    "fastAvgMs: 14",
    "fastHoldSeconds: 8",
    "maxUpgrades: 2",
    "warmupSeconds: 3",
  ]) {
    assert.ok(source.includes(marker), `ADAPTIVE_RULES 应含 ${marker}`);
  }
  // 升降执行：档位切换走 setTier（React 状态仅在档位变化时更新一次），
  // 换档清空采样窗（旧帧时间不代表新档负载），并通知 HUD
  assert.match(source, /setTier\(next\)/, "判定达成应切换档位");
  assert.match(source, /notifyQuality\(TIER_NOTICE\[next\]\)/, "档位变化应通知 HUD");
  assert.match(source, /buffer\.length = 0/, "换档应清空采样窗");
  assert.match(source, /setDpr\(Math\.min\(devicePixelRatio, tier\.dprMax\)\)/, "DPR 应随档位 setDpr 动态生效");
  // 三档 HUD 通知文案齐备（一次性提示，不做性能宣称）
  for (const tier of ["high", "medium", "low"]) {
    assert.match(source, new RegExp(`${tier}: "[^"]+"`), `应有 ${tier} 档通知文案`);
  }
});

test("性能：档位动态生效链路（useQuality 消费 + 阴影管线动态开关含显存释放）", () => {
  const canvas = readProjectFile("components/world/WorldCanvas.tsx");
  // ShadowToggle：阴影管线随档位动态开关
  assert.match(canvas, /applyShadowPipeline/, "应有阴影管线切换入口");
  assert.match(canvas, /gl\.shadowMap\.enabled/, "应同步 renderer 阴影开关");
  assert.match(canvas, /shadow\.map\.dispose\(\)/, "关档应释放阴影贴图显存");
  assert.match(canvas, /needsUpdate = true/, "开关阴影应标记材质重编译");
  // 场景组件继续随 tier prop 重渲（粒子 / 远景 / 贴图 / transmission）
  assert.match(canvas, /<CloudLayer tier=\{tier\} \/>/, "云层应消费动态档位");
  assert.match(canvas, /<DistantIsles tier=\{tier\} \/>/, "远景岛应消费动态档位");
  assert.match(canvas, /screenTextures=\{tier\.screenTextures\}/, "屏幕贴图应随档位挂载");
  assert.match(canvas, /mistCount=\{Math\.floor\(tier\.particleBudget \/ 5\)\}/, "水雾粒子应随档位预算");
  // HUD 一次性提示：context 存 4s 自动清除
  const context = readProjectFile("components/world/WorldUIContext.tsx");
  assert.match(context, /notifyQuality/, "WorldUIContext 应提供档位通知");
  assert.match(context, /setTimeout\(\(\) => setQualityNotice\(null\), 4000\)/, "档位提示应 4s 自动清除");
  const hud = readProjectFile("components/world/ui/HudOverlay.tsx");
  assert.match(hud, /world-hud__quality/, "HUD 应渲染档位提示");
  const css = readProjectFile("app/globals.css");
  const qualityRule = css.match(/\.world-hud__quality\s*\{([\s\S]*?)\}/);
  assert.ok(qualityRule, "globals.css 应有 .world-hud__quality 规则");
  assert.match(qualityRule[1], /color:\s*var\(--color-text-secondary\)/, "档位提示应使用深墨令牌");
});

test("移动端：交互距离 ×1.4、3D 热区外扩、提示按钮 52px、相机弱回正与双指捏合", () => {
  assert.equal(INTERACTION.mobileRadiusScale, 1.4, "触屏交互距离倍率应为 1.4（6→8.4）");

  const interaction = readProjectFile("components/world/systems/InteractionSystem.tsx");
  assert.match(
    interaction,
    /isMobileLike \? INTERACTION\.mobileRadiusScale : 1/,
    "交互采样应按触屏放大半径",
  );

  const isle = readProjectFile("components/world/objects/ProjectIsle.tsx");
  assert.match(isle, /mobileRadiusScale/, "名牌/高亮距离应消费触屏倍率");
  assert.match(
    isle,
    /isMobileLike \? 2\.5 : 1\.5/,
    "交互代理圆柱触屏应再外扩（点击热区 ≥3 单位 + 1）",
  );

  // CSS：触屏提示条 52px（≥44px 底线上的触屏加档）
  const css = readProjectFile("app/globals.css");
  const mobileBlock = css.slice(css.indexOf("@media (max-width: 640px)"));
  const promptMobile = mobileBlock.match(/\.world-hud__prompt-btn\s*\{([\s\S]*?)\}/);
  assert.ok(promptMobile, "移动端块应有提示条按钮规则");
  assert.match(promptMobile[1], /min-height:\s*3\.25rem/, "触屏提示按钮应 52px");

  // 相机：触屏自动回正更弱 + 拖拽差值自算（Safari iOS 触摸 PointerEvent 无 movementX）+ 双指捏合
  const camera = readProjectFile("components/world/systems/FollowCamera.tsx");
  assert.doesNotMatch(camera, /event\.movementX/, "不得依赖 event.movementX（触屏恒 0 的兼容坑）");
  assert.match(camera, /event\.clientX - prev\.x/, "拖拽增量应自算差值");
  assert.match(camera, /pointers\.size >= 2/, "应识别双指捏合");
  assert.match(camera, /inputState\.zoomStep \+= 1/, "捏合应接入距离档通道");
  assert.match(camera, /alignWeight \* 2 \* delta/, "yaw 对齐应使用可调权重");
  assert.equal(MOBILE_MODIFIERS.cameraAlignWeight, 0.15, "触屏回正权重应为 0.15（桌面 0.4）");
  const canvas = readProjectFile("components/world/WorldCanvas.tsx");
  assert.match(
    canvas,
    /alignWeight=\{isMobileLike \? MOBILE_MODIFIERS\.cameraAlignWeight : 0\.4\}/,
    "相机应按设备形态传对齐权重",
  );
  // 触屏提示文案不带键盘按键（E 键对触屏无意义）
  const hud = readProjectFile("components/world/ui/HudOverlay.tsx");
  assert.match(hud, /isMobileLike[\s\S]{0,120}`查看 \$\{prompt\.label\}`/, "触屏提示文案应为「查看 ···」");
});

test("可访问性：reduced-motion 覆盖全部帧循环环境动画（objects/terrain 无遗漏）", () => {
  const worldDir = path.join(projectRoot, "components", "world");
  const scan = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return scan(full);
      return /\.(tsx|ts)$/.test(entry.name) ? [full] : [];
    });
  const files = scan(worldDir);
  // 含 useFrame 的 objects/terrain 组件 = 环境动画载体，必须消费 reduced-motion
  for (const file of files.filter((f) => /[\\/](objects|terrain)[\\/]/.test(f))) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("useFrame")) continue;
    assert.ok(
      src.includes("usePrefersReducedMotion"),
      `${path.relative(projectRoot, file)} 含帧循环动画，应消费 usePrefersReducedMotion（§12.3）`,
    );
  }
  // 系统组件白名单（玩家控制 / 相机跟随 / 低频采样属「可控性优先」，不强制）：
  // usePlayerController / FollowCamera / InteractionSystem / useIdleSeconds / useNearPlayer
});

test("降级与恢复：WebGL 上下文丢失守卫 + 恢复遮罩（不白屏不静默）", () => {
  const guard = readProjectFile("components/world/systems/ContextGuard.tsx");
  assert.match(guard, /webglcontextlost/, "应监听上下文丢失");
  assert.match(guard, /event\.preventDefault\(\)/, "丢失事件应 preventDefault 以允许恢复");
  assert.match(guard, /webglcontextrestored/, "应监听上下文恢复");
  assert.match(guard, /removeEventListener/, "卸载应注销监听");

  const shell = readProjectFile("components/world/WorldShell.tsx");
  assert.match(shell, /world-context-mask/, "上下文丢失应显示恢复遮罩");
  assert.match(shell, /window\.location\.reload\(\)/, "遮罩应提供刷新页面出口");
  assert.match(shell, /href="\/projects"/, "遮罩应提供项目列表降级入口");
  const css = readProjectFile("app/globals.css");
  const maskRule = css.match(/\.world-context-mask\s*\{([\s\S]*?)\}/);
  assert.ok(maskRule, "globals.css 应有遮罩样式");
  assert.match(maskRule[1], /z-index:\s*40/, "遮罩应盖过 HUD");
});

test("加载失败路径：资源失败如实提示 + 重试 + 项目列表降级入口（§13.2）", () => {
  const loading = readProjectFile("components/world/loading/LoadingScreen.tsx");
  assert.match(loading, /errors\.length > 0/, "应消费 useProgress 的 errors");
  assert.match(loading, /部分区域未能点亮/, "失败文案应如实");
  assert.match(loading, /world-loading__retry/, "应有重试按钮");
  assert.match(loading, /href="\/projects"/, "应有项目列表降级链接");
  assert.match(loading, /直接浏览项目列表/, "降级链接应有明确文案");
});

test("资源清理审计：显式创建的 GPU 资源全部 dispose，监听器成对注销", () => {
  const worldDir = path.join(projectRoot, "components", "world");
  const scan = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return scan(full);
      return /\.(tsx|ts)$/.test(entry.name) ? [full] : [];
    });
  // 显式 new 的 GPU 资源（几何/材质/纹理/渲染目标）必须同文件 dispose；
  // 白名单 = 几何工厂（返回值由调用方 dispose，调用方均在本断言覆盖内）
  const factoryWhitelist = new Set(["FloatingRock.ts", "butterflyShape.ts", "ribbonGeometry.ts"]);
  const gpuResource = /new\s+[A-Z]\w*(Geometry|Material|Texture|PMREMGenerator|WebGLRenderTarget)\b/;
  for (const file of scan(worldDir)) {
    if (factoryWhitelist.has(path.basename(file))) continue;
    const src = readFileSync(file, "utf8");
    if (!gpuResource.test(src)) continue;
    assert.ok(
      src.includes(".dispose()"),
      `${path.relative(projectRoot, file)} 显式创建 GPU 资源，应含 dispose`,
    );
  }
  // 指针监听含 pointercancel（触摸中断不清残留会卡死拖拽态）
  const camera = readProjectFile("components/world/systems/FollowCamera.tsx");
  assert.match(camera, /addEventListener\("pointercancel"/, "应监听 pointercancel");
  assert.ok(
    (camera.match(/removeEventListener/g) ?? []).length >= 5,
    "相机五组监听（含 pointercancel）都应注销",
  );
  // 自适应零逐帧 React 状态：setTier 调用只在升降档分支内
  const adaptive = readProjectFile("components/world/systems/AdaptiveQuality.tsx");
  const setTierCalls = adaptive.split("\n").filter((line) => line.includes("setTier(next)"));
  assert.equal(setTierCalls.length, 2, "setTier 仅应在降档/升档两处分支调用");
});

test("性能：加载屏真实进度（useProgress），禁假百分比", () => {
  const loading = readProjectFile("components/world/loading/LoadingScreen.tsx");
  assert.match(loading, /useProgress/);
  assert.doesNotMatch(loading, /9[05]%|100%/);
});

test("性能：非首屏图片一律懒加载（项目卡默认不 priority，关于我插画无 priority）", () => {
  const card = readProjectFile("components/projects/ProjectCard.tsx");
  assert.match(card, /priority = false/, "项目卡 priority 应默认关闭");

  const about = readProjectFile("components/home/AboutSection.tsx");
  const imageBlock = about.match(/<Image[\s\S]*?\/>/);
  assert.ok(imageBlock, "AboutSection 应有插画 Image");
  assert.doesNotMatch(imageBlock[0], /priority/, "关于我插画不应 priority（懒加载）");
});

test("性能与清理：世界输入监听与指针监听卸载注销，共享输入态复位", () => {
  const controller = readProjectFile("components/world/systems/usePlayerController.ts");
  assert.match(controller, /return \(\) => \{/, "控制器卸载应清理监听");
  assert.ok((controller.match(/removeEventListener/g) ?? []).length >= 3, "键盘三组监听都应注销");

  const follow = readProjectFile("components/world/systems/FollowCamera.tsx");
  assert.ok((follow.match(/removeEventListener/g) ?? []).length >= 4, "相机指针/滚轮监听应注销");

  const canvas = readProjectFile("components/world/WorldCanvas.tsx");
  assert.match(canvas, /resetInputState\(\)/, "Canvas 卸载应复位共享输入态");
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

  // 世界层专用降级（品牌呼吸 / 进度扫描 / 区域名牌入场全部静止）
  assert.match(reducedBlock, /\.world-brand__logo[^{]*\{[^}]*animation:\s*none/);
});
