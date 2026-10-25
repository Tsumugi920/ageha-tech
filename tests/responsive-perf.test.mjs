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
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { TIER_PARAMS, MOBILE_MODIFIERS } from "../lib/world/performance.ts";

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
    "world-hud__prompt-link",
    "world-hud__hint-dot",
    "world-hud__quick-item",
    "world-hud__quick-mini",
    "world-toast__primary",
    "world-toast__ghost",
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

test("性能：WorldCanvas 按档位限 DPR 与阴影，SSR 安全动态装载", () => {
  const canvas = readProjectFile("components/world/WorldCanvas.tsx");
  assert.match(canvas, /"use client"/);
  assert.match(canvas, /dpr=\{\[1, tier\.dprMax\]\}/, "DPR 应限制在 [1, 档位上限]");
  assert.match(
    canvas,
    /shadows=\{tier\.shadows !== false \? true : false\}/,
    "阴影应随档位开关（three 0.186 已移除 PCFSoft，用默认 PCF）",
  );
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
