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

test("断点布局：项目卡片移动单列（显式 grid-cols-1 防隐式 auto 轨道被标签行撑宽）、md 两列防 1024 窄卡截断、xl 恢复三等列（首页精选与 /projects 列表一致）", () => {
  for (const file of [
    "components/home/FeaturedProjects.tsx",
    "app/projects/page.tsx",
  ]) {
    const src = readProjectFile(file);
    assert.match(src, /grid list-none grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3/,
      `${file} 卡片网格应为显式单列（minmax(0,1fr)）+ md:grid-cols-2 + xl:grid-cols-3（md 起间距 32px）`);
  }
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

test("宽屏构图：Hero 右缘章节面板减重为幽灵玻璃（不抢蝴蝶主视觉）", () => {
  const hero = readProjectFile("components/home/Hero.tsx");
  assert.match(
    hero,
    /border-white\/45 bg-white\/30 px-4 py-6 shadow-\[0_3px_14px_rgba\(71,115,183,0\.10\)\] backdrop-blur-md/,
    "章节面板应为 30% 白玻璃 + 细边 + 轻投影（幽灵级，退到场景之后）",
  );
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

  // 场景容器：移动端 46svh 顶部横幅（绝对定位），lg+ 转入两栏栅格右列（42fr_58fr）
  assert.match(
    scene,
    /pointer-events-none absolute inset-x-0 top-0 z-0 h-\[46svh\] lg:relative lg:inset-auto lg:col-start-2 lg:row-start-1 lg:h-full/,
  );
  // 文案在场景之下：顶部内边距 ≥ 场景高度（纵向堆叠不重叠）；
  // lg+ 去掉 pt-36 下坠，改为 clamp 适度上移（col/row 定位与 gutter 边距夹在中间）；
  // 左缘 hero-inset-pl 对齐统一主容器内容缘（非视口 gutter，见下一条测试）
  assert.match(
    hero,
    /pt-\[46svh\] sm:px-10 hero-inset-pl lg:col-start-1 lg:row-start-1 lg:pr-\(--site-gutter\) lg:pb-14 lg:pt-\[clamp\(4rem,8svh,7rem\)\]/,
  );
  // 横向溢出保险丝：轨道环 / 光斑等装饰超出画布时被首屏裁切
  assert.match(hero, /hero-root relative isolate flex min-h-\[calc\(100svh-4\.5rem\)\] flex-col overflow-hidden/);
  // 桌面高度随视口 clamp（720–960px，2560×1440 主设计目标下 ~960px 首屏），
  // 并撤掉 min-h 与高度上限的冲突
  assert.match(
    hero,
    /lg:grid lg:h-\[clamp\(720px,calc\(100svh-4\.5rem\),960px\)\] lg:min-h-0 lg:grid-cols-\[42fr_58fr\] lg:grid-rows-1/,
  );
});

test("断点布局：Hero 内容缘对齐统一主容器（hero-inset-* 出血内缩，非视口 gutter）", () => {
  const hero = readProjectFile("components/home/Hero.tsx");
  const css = readProjectFile("app/globals.css");

  // hero-root 为 inline-size 容器：cqw 度量 hero 真实布局宽（不含滚动条），
  // 与 .site-container 的居中计算同源
  const heroRootRule = css.match(/\.hero-root\s*\{([\s\S]*?)\}/);
  assert.ok(heroRootRule, "globals.css 应有 .hero-root 规则");
  assert.match(heroRootRule[1], /container-type:\s*inline-size/);

  // 三个 hero-inset-* 工具类就位：inset = gutter + max(0, (宽−容器)/2)，
  // 基准统一读 --container-max（四档阶梯在 :root 媒体查询里切换，
  // 与 .site-container / .site-shell 同源），不再逐档写重复媒体查询
  const insetFormula =
    /max\(\s*var\(--site-gutter\),\s*calc\(50cqw - var\(--container-max\) \/ 2 \+ var\(--site-gutter\)\)\s*\)/;
  for (const name of ["hero-inset-pl", "hero-inset-r", "hero-inset-l"]) {
    const rules = [...css.matchAll(new RegExp(`\\.${name}\\s*\\{([\\s\\S]*?)\\}`, "g"))];
    assert.ok(rules.length === 1, `globals.css 应有 .${name} 的单条阶梯基准规则`);
    for (const rule of rules) {
      assert.match(rule[1], insetFormula, `.${name} 应使用 --container-max 的 cqw 内缩公式`);
    }
  }

  // Hero 三处消费：左文案列、右缘章节面板外缘、左缘 SCROLL 提示
  assert.match(hero, /sm:px-10 hero-inset-pl/);
  assert.match(hero, /hero-reveal hero-inset-r absolute/);
  assert.match(hero, /hero-reveal hero-inset-l absolute/);
});

test("断点布局：lg+ 场景条右缘锚定容器内容缘（hero-scene-r，防超宽视口蝴蝶压面板）", () => {
  const css = readProjectFile("app/globals.css");
  const scene = readProjectFile("components/home/HeroScene.tsx");

  // hero-scene-r 与 hero-inset-r 同构：单一规则读 --container-max 阶梯基准
  assert.match(
    css,
    /\.hero-scene-r\s*\{[\s\S]*?calc\(50cqw - var\(--container-max\) \/ 2 \+ var\(--site-gutter\)\)/,
    "hero-scene-r 应使用 --container-max 阶梯基准",
  );

  // HeroScene 消费：场景条挂 hero-scene-r，且高度 / 宽度上限就位
  // （2560×1440 主设计目标：容器 1840 → 右列 ≈1067px，场景上限 64rem/40rem
  //   让蝴蝶成为明确视觉主体；翅尖最外渐隐段对称出血）
  assert.match(scene, /hero-scene-r/);
  assert.match(
    scene,
    /lg:h-\[clamp\(28rem,66svh,40rem\)\] lg:w-\[min\(64rem,100%\)\]/,
    "场景条应有 40rem 高度上限与 64rem 宽度上限",
  );
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

  // ≥1920 宽屏：场景条放宽到 64rem 后轨道环同步放大（比例不失调）
  const xlBlock = css.match(/@media \(min-width: 1920px\)\s*\{\s*\.hero-orbit-layer\s*\{([\s\S]*?)\}/);
  assert.ok(xlBlock, "应有 ≥1920 断点的轨道放大规则");
  assert.match(xlBlock[1], /--orbit-a:\s*clamp\(24rem,\s*46vw,\s*52rem\)/);
  assert.match(xlBlock[1], /--orbit-b:\s*clamp\(30rem,\s*60vw,\s*62rem\)/);

  // 光晕：移动端 14rem 起步，lg+ 恢复 22rem；上限 34rem（场景放大后同步），
  // lg+ 中心随右下锚定的场景盒下移（left/top 定位类夹在 rounded-full 与 lg 尺寸之间）
  const scene = readProjectFile("components/home/HeroScene.tsx");
  assert.match(
    scene,
    /w-\[clamp\(14rem,44vw,30rem\)\] -translate-x-1\/2 -translate-y-1\/2 rounded-full lg:left-\[48%\] lg:top-\[54%\] lg:w-\[clamp\(22rem,44vw,34rem\)\]/,
  );
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

  // 导航栏用 site-shell（修复旧静态 max-w-site 在 ≥1600px 视口
  // 恒 1360px、与正文容器相差 80px 且永不放宽的错位）
  const navbar = readProjectFile("components/layout/Navbar.tsx");
  assert.match(navbar, /glass-panel site-shell flex items-center justify-between/,
    "导航栏应使用 site-shell 随阶梯放宽并与正文容器同缘");

  // 首页版块直接坐在统一容器上（保留纵向节奏类）
  const featured = readProjectFile("components/home/FeaturedProjects.tsx");
  assert.match(featured, /site-container scroll-mt-24 py-20/);
});

test("全站节奏：版块纵向间距以 64–88px 为基线按密度微调（py-16 / py-20 / lg:py-22）", () => {
  // 首页七个版块 + 内页容器的纵向节奏类逐一落在 64–88px 基线内：
  // py-16=64（紧凑型：时间线 / 文章）、py-20=80（标准）、Contact lg:py-22=88（收尾加重）
  const sectionRhythms = [
    ["components/home/FeaturedProjects.tsx", /site-container scroll-mt-24 py-20/],
    ["components/home/AboutSection.tsx", /site-container scroll-mt-24 py-20/],
    ["components/home/TechStackSection.tsx", /site-container scroll-mt-24 py-20/],
    ["components/home/LatestNotes.tsx", /site-container scroll-mt-24 py-16/],
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
  // 内容卡（glass-card / GlassCard / 玻璃方向小卡）内边距统一收进 20–28px：
  for (const [file, pattern] of [
    ["components/projects/ProjectCard.tsx", /flex h-full flex-col border-\[#9EC4EC\] p-5 transition[\s\S]*?sm:p-6/],
    ["components/home/LatestNotes.tsx", /glass-card relative flex h-full flex-col rounded-2xl p-5/],
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
    "components/home/LatestNotes.tsx",
    "app/articles/page.tsx",
  ];
  for (const file of cardFiles) {
    const src = readProjectFile(file);
    assert.doesNotMatch(src, /glass-card[^\n]*\bp-[34]\b/, `${file} 玻璃卡不应再用 p-3 / p-4`);
    assert.doesNotMatch(src, /GlassCard[^\n]*\bp-[34]\b/, `${file} GlassCard 不应再用 p-3 / p-4`);
  }
});

test("可读性：卡片正文 ≥14px（text-sm 起），技术标签 13px 可辨认，无 12px 及以下正文", () => {
  // 卡片标题与摘要正文统一 14px（text-sm），文章页与首页文章卡同语言
  for (const file of ["components/home/LatestNotes.tsx", "app/articles/page.tsx"]) {
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
  // 技术栈矩阵条目名 14px 正文色 + 44px 图标底板（第三轮精修：放大技术图标与名称）
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

  // 项目卡入口：胶囊 py-1×2 + size-9 圆钮 = 44px 触控高度
  const card = readProjectFile("components/projects/ProjectCard.tsx");
  assert.match(
    card,
    /group\/arrow inline-flex shrink-0 items-center gap-2 rounded-full border border-white\/70 bg-white\/60 py-1 pl-3\.5 pr-1/,
    "项目卡入口胶囊类串应就位",
  );
  assert.match(
    card,
    /查看详情/,
    "入口应有可见的「查看详情」文案",
  );
  assert.match(
    card,
    /grid size-9 place-items-center rounded-full bg-linear-to-br from-cyan to-blue/,
    "入口圆钮应 36px（加胶囊内边距合计 ≥44px）",
  );
  assert.match(
    card,
    /focus-visible:outline-focus-ring/,
    "入口焦点环应使用加深档",
  );
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

test("对比度：联系区暮光天幕 + 浅玻璃幕带使用深墨正文，text-white 仅限青色 CTA", () => {
  const contact = readProjectFile("components/home/ContactSection.tsx");
  // 幕带为实底浅玻璃（bg-glass-strong），正文一律深墨，暮光任一区段可读
  assert.match(contact, /bg-glass-strong/, "联系区内容应收进实底浅玻璃幕带");
  assert.match(
    contact,
    /text-text-primary/,
    "暮光天幕上的浅玻璃幕带正文应为深墨",
  );
  assert.doesNotMatch(
    contact,
    /text-\[#C6DAF6\]/,
    "夜景浅蓝正文随深色大板一并移除",
  );
  // text-white 仅允许出现在青色渐变 CTA 胶囊上（白字在青底 ≥3:1 大字按钮）
  const whiteText = contact.match(/(?<![\w/-])text-white(?![\w/-])/g) ?? [];
  assert.equal(
    whiteText.length,
    1,
    "text-white 只应出现在 CTA 胶囊一处",
  );
  assert.match(contact, /px-6 py-3 text-sm font-semibold text-white/);
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
  // sizes 与场景盒宽同步：≥2560 场景有 64rem 硬上限（1024px），
  // lg+ 场景占两栏栅格右列（58%），移动端全宽
  assert.match(scene, /sizes="\(min-width: 2560px\) 1024px, \(min-width: 1024px\) 58vw, 100vw"/);
  // 预留空间：场景容器为固定视口高度的绝对定位横幅（图片加载不改变文档流）；
  // lg+ 转为栅格右列（relative），高度由 42fr_58fr 行高承接，同样无布局跳动
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
