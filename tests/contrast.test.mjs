/**
 * 对比度与可读性测试（node:test）—— 对应视觉审计 9 条意见的数值级回归。
 *
 * 以 WCAG 2.x 相对亮度公式真实核算（sRGB 线性化 → 亮度 → 对比度），
 * 背景按站点真实叠层做 alpha 合成：
 * - 页面底 sky #DDF3FF / ice #F1F8FF；
 * - 玻璃面板 = 白 48% 叠在页面底上；玻璃卡 = 白 74%；
 * - 导航激活胶囊 = 白 75% 叠在玻璃上；
 * - body::before 氛围斑（fixed，滚动时内容会穿过）取较强的
 *   rgba(38,157,255,0.14) 叠加态作为玻璃底的最坏情况；
 * - Hero 右缘面板 = 白 45% 玻璃叠在明暗两端场景色上（夹逼）。
 *
 * 阈值：正文/小字 4.5:1，大字（≥24px 或 ≥18.66px bold）3:1，
 * 非文本焦点指示 3:1。运行方式：npm test
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { projects } from "../lib/projects.ts";
import { techGroups } from "../lib/tech-stack.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

/* --------------------------- WCAG 2.x 数学 --------------------------- */

const srgbToLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }) =>
  0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);

const hexToRgb = (hex) => {
  const s = hex.replace("#", "");
  assert.match(s, /^[0-9a-fA-F]{6}$/, `颜色 "${hex}" 应为 #RRGGBB`);
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
};

const contrast = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** alpha 合成：上层 rgba(fg, alpha) 叠在下层 bg 上 */
const over = (fg, alpha, bg) => ({
  r: fg.r * alpha + bg.r * (1 - alpha),
  g: fg.g * alpha + bg.g * (1 - alpha),
  b: fg.b * alpha + bg.b * (1 - alpha),
});

/* --------------------------- 背景与令牌 --------------------------- */

const WHITE = { r: 255, g: 255, b: 255 };
const SKY = hexToRgb("#DDF3FF");
const ICE = hexToRgb("#F1F8FF");

/** body::before 氛围斑较强处：rgba(38,157,255,0.14) 叠在 sky 上（fixed，内容会穿过） */
const skyWithBlob = over(hexToRgb("#269DFF"), 0.14, SKY);

/** 全套真实玻璃底（由浅到深） */
const GLASS_BGS = {
  "导航激活白75/玻璃/sky": over(WHITE, 0.75, over(WHITE, 0.48, SKY)),
  "导航激活白75/玻璃/sky+氛围斑": over(WHITE, 0.75, over(WHITE, 0.48, skyWithBlob)),
  "glass-card白74/sky": over(WHITE, 0.74, SKY),
  "glass/ice": over(WHITE, 0.48, ICE),
  "glass/sky": over(WHITE, 0.48, SKY),
  "glass/sky+氛围斑": over(WHITE, 0.48, skyWithBlob),
  "裸sky(页面顶)": SKY,
};

/** Hero 右缘面板：白 45% 玻璃叠在场景图明暗两端（夹逼最坏情况） */
const PANEL_BGS = [
  over(WHITE, 0.45, hexToRgb("#F0F8FE")),
  over(WHITE, 0.45, hexToRgb("#7FB0E0")),
  over(WHITE, 0.45, hexToRgb("#5E93CC")),
];

/** 解析 globals.css @theme 块（与 design-system.test.mjs 同款配平解析） */
function parseThemeTokens(css) {
  const themeStart = css.indexOf("@theme");
  const open = css.indexOf("{", themeStart);
  let depth = 0;
  let close = -1;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  const tokens = new Map();
  for (const declaration of css.slice(open + 1, close).split(";")) {
    const match = declaration.match(/(--[\w-]+)\s*:\s*([\s\S]+)/);
    if (match) tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

const css = readProjectFile("app/globals.css");
const tokens = parseThemeTokens(css);
const linkRgb = hexToRgb(tokens.get("--color-link"));
const linkHoverRgb = hexToRgb(tokens.get("--color-link-hover"));
const focusRgb = hexToRgb(tokens.get("--color-focus-ring"));

/** 解析 .hero-gradient-* 的全部渐变端点（按出现顺序） */
function parseGradientStops(className) {
  const rule = css.match(
    new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`),
  );
  assert.ok(rule, `globals.css 应包含 .${className} 规则`);
  return [...rule[1].matchAll(/#[0-9a-fA-F]{6}/g)].map((m) =>
    hexToRgb(m[0]),
  );
}

/* ------------------------------ 链接用色 ------------------------------ */

test("链接用色 ≥4.5:1：--color-link / --color-link-hover 在全套真实玻璃底上达标", () => {
  // 品牌蓝 #269DFF 作为 14px 文字仅 2.66:1（审计意见 3），
  // 链接文字必须用加深档；品牌蓝令牌本身保留（图标/渐变等非文字用途）
  assert.equal(tokens.get("--color-blue"), "#269DFF", "品牌蓝令牌应保持不变");
  for (const [bgName, bg] of Object.entries(GLASS_BGS)) {
    const linkRatio = contrast(linkRgb, bg);
    assert.ok(
      linkRatio >= 4.5,
      `--color-link 对 ${bgName} 实测 ${linkRatio.toFixed(2)}:1，14px 文字需 ≥4.5:1`,
    );
    const hoverRatio = contrast(linkHoverRgb, bg);
    assert.ok(
      hoverRatio >= 4.5,
      `--color-link-hover 对 ${bgName} 实测 ${hoverRatio.toFixed(2)}:1，14px 文字需 ≥4.5:1`,
    );
  }
});

test("文字链接不再使用品牌蓝/品牌紫：View All / 查看更多 / 了解更多 / 导航激活全部换加深档", () => {
  const strictFiles = [
    "components/home/FeaturedProjects.tsx",
    "components/home/LatestNotes.tsx",
    "components/home/TechStackSection.tsx",
    "components/ui/SectionHeading.tsx",
    "components/layout/SiteNavLinks.tsx",
  ];
  for (const file of strictFiles) {
    const src = readProjectFile(file);
    // 文字链接的两种特征形态（font-semibold text-blue 链接 / hover 品牌紫）
    // 不得再出现；aria-hidden 装饰性图标上的 text-blue 非文字，不在本禁令内
    assert.doesNotMatch(
      src,
      /font-semibold text-blue(?![\w/-])/,
      `${file} 的文字链接不得再用品牌蓝 text-blue`,
    );
    assert.doesNotMatch(
      src,
      /hover:text-purple/,
      `${file} 的 hover 色不得再用品牌紫 text-purple`,
    );
    assert.match(src, /text-link/, `${file} 文字链接应使用 text-link`);
  }

  // SiteNavLinks 与 SectionHeading 内没有装饰性图标，可整体禁用品牌蓝文字
  for (const file of [
    "components/layout/SiteNavLinks.tsx",
    "components/ui/SectionHeading.tsx",
  ]) {
    const src = readProjectFile(file);
    assert.doesNotMatch(src, /(?<![-\w])text-blue(?![\w/-])/, `${file} 不得再出现品牌蓝文字`);
    assert.doesNotMatch(src, /(?<![-\w])text-purple(?![\w/-])/, `${file} 不得再出现品牌紫文字`);
  }

  // AboutSection：ghost 按钮文字换 text-link；fact 图标 text-blue 为
  // aria-hidden 装饰性图标（非文字，不适用 4.5:1），允许保留
  const about = readProjectFile("components/home/AboutSection.tsx");
  assert.doesNotMatch(about, /text-blue hover:text-blue/, "ghost 按钮不得再用品牌蓝文字");
  assert.doesNotMatch(about, /from-blue to-purple/, "「自己」渐变不得再用品牌蓝紫对");
  assert.match(about, /border-link\/40 text-link hover:text-link/);
  assert.match(about, /from-link to-link-hover/, "「自己」渐变应使用加深档蓝紫对");

  // 「自己」渐变两端（14px semibold，需 4.5:1）在 About 玻璃底上核算
  for (const bgName of ["glass/sky", "glass/sky+氛围斑", "glass-card白74/sky"]) {
    const bg = GLASS_BGS[bgName];
    assert.ok(
      contrast(linkRgb, bg) >= 4.5 && contrast(linkHoverRgb, bg) >= 4.5,
      `「自己」渐变端点对 ${bgName} 需 ≥4.5:1`,
    );
  }
});

/* ------------------------------ 焦点环 ------------------------------ */

test("焦点环 ≥3:1（WCAG 1.4.11/2.4.11）：--color-focus-ring 对天空/玻璃/玻璃卡全部达标", () => {
  for (const [bgName, bg] of Object.entries(GLASS_BGS)) {
    const ratio = contrast(focusRgb, bg);
    assert.ok(
      ratio >= 3,
      `焦点环对 ${bgName} 实测 ${ratio.toFixed(2)}:1，非文本指示需 ≥3:1`,
    );
  }
});

/* --------------------------- Hero 渐变文字 --------------------------- */

test("hero-gradient-tech / -zh（大字）：全部端点对 sky ≥3:1", () => {
  for (const className of ["hero-gradient-tech", "hero-gradient-zh"]) {
    const stops = parseGradientStops(className);
    assert.ok(stops.length >= 3, `${className} 应至少有 3 个渐变端点`);
    stops.forEach((stop, i) => {
      const ratio = contrast(stop, SKY);
      assert.ok(
        ratio >= 3,
        `${className} 端点#${i + 1} 对 sky 实测 ${ratio.toFixed(2)}:1，大字需 ≥3:1`,
      );
    });
  }
});

test("hero-gradient-accent（15px 正文）：全部端点对 sky ≥4.5:1", () => {
  const stops = parseGradientStops("hero-gradient-accent");
  stops.forEach((stop, i) => {
    const ratio = contrast(stop, SKY);
    assert.ok(
      ratio >= 4.5,
      `accent 端点#${i + 1} 对 sky 实测 ${ratio.toFixed(2)}:1，15px 正文需 ≥4.5:1`,
    );
  });
});

/* ------------------------- Hero 品牌字与右缘面板 ------------------------- */

test("Hero 品牌字「Ageha.」深藏青：对 sky 与氛围层 ≥3:1，且不再用白字", () => {
  const hero = readProjectFile("components/home/Hero.tsx");
  // 白字对 sky 仅 1.15:1；氛围层 0.75 方案实测也只能到 2.55:1，
  // 故改深藏青（与第二行中文 #193154 同墨）
  assert.match(hero, /text-\[#193154\]">Ageha\./);
  assert.doesNotMatch(
    hero,
    /(?<![-\w])text-white(?![\w/-])/,
    "Hero 左栏玻璃/天空底上不得再有白色正文",
  );
  const navy = hexToRgb("#193154");
  assert.ok(contrast(navy, SKY) >= 3, `深藏青对 sky 实测 ${contrast(navy, SKY).toFixed(2)}:1`);
  // 氛围层（rgba(64,139,237,0.42) 叠 sky）比 sky 更深，对比度只会更高
  const atmosphere = over(hexToRgb("#408BED"), 0.42, SKY);
  assert.ok(
    contrast(navy, atmosphere) >= 3,
    `深藏青对氛围层实测 ${contrast(navy, atmosphere).toFixed(2)}:1`,
  );
});

test("Hero 右缘面板小字 ≥4.5:1：章节链接不透明加深、竖排/计数同步加深", () => {
  const hero = readProjectFile("components/home/Hero.tsx");

  // 旧值：#33568C/75 在面板底上 2.27~3.96:1
  assert.doesNotMatch(hero, /#33568C\/75/, "非激活章节不得再用 /75 透明度品牌蓝");
  const chapterInk = hexToRgb("#2A4C80");
  const verticalInk = hexToRgb("#24457A");
  const activeInk = hexToRgb("#0B2B5C");
  PANEL_BGS.forEach((bg, i) => {
    assert.ok(
      contrast(chapterInk, bg) >= 4.5,
      `非激活章节 #2A4C80 对面板底#${i + 1} 实测 ${contrast(chapterInk, bg).toFixed(2)}:1`,
    );
    assert.ok(
      contrast(verticalInk, bg) >= 4.5,
      `竖排/计数 #24457A 对面板底#${i + 1} 实测 ${contrast(verticalInk, bg).toFixed(2)}:1`,
    );
    assert.ok(contrast(activeInk, bg) >= 4.5);
  });
  // 竖排 / 计数不再带透明度后缀（同步加深为全不透明）
  assert.doesNotMatch(hero, /#24457A\/\d+/);
});

/* --------------------------- 统计口径对齐 --------------------------- */

test("Hero 统计口径与站内可数内容逐项对齐：16 = 技术项实数，3+ = 项目实数", () => {
  const hero = readProjectFile("components/home/Hero.tsx");
  const techItemCount = techGroups.reduce((sum, group) => sum + group.items.length, 0);

  // 16 项在用/在学技术 = lib/tech-stack.ts 四组 × 四项的真实计数
  assert.match(
    hero,
    new RegExp(`\\{ value: "${techItemCount}", label: "在用/在学技术" \\}`),
    `统计值应等于 techGroups 实际技术项数 ${techItemCount}`,
  );
  assert.ok(techItemCount > 0 && techGroups.length === 4, "技术栈应为四组真实数据");

  // 3+ 代表项目 = lib/projects.ts 项目数（3+ 为「以上」语义，允许 ≥）
  assert.match(
    hero,
    new RegExp(`\\{ value: "${projects.length}\\+", label: "代表项目" \\}`),
    `统计值应与 projects.length = ${projects.length} 一致`,
  );

  // 不得回退到不可数的「5+ 技术领域」式表述
  assert.doesNotMatch(hero, /5\+/);
  assert.doesNotMatch(hero, /技术领域/);
});

/* --------------------------- text-muted 小字 --------------------------- */

test("text-muted（#6F86A4，玻璃底最高 3.67:1）不再用于任何组件文字，小字一律 text-secondary", () => {
  const scan = (dir, hits) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full, hits);
      else if (entry.name.endsWith(".tsx")) {
        const src = readFileSync(full, "utf8");
        if (src.includes("text-text-muted")) hits.push(path.relative(projectRoot, full));
      }
    }
    return hits;
  };
  const hits = [
    ...scan(path.join(projectRoot, "app"), []),
    ...scan(path.join(projectRoot, "components"), []),
  ];
  assert.deepEqual(
    hits,
    [],
    `以下文件仍在使用 text-text-muted（#6F86A4 对玻璃底 3.48~3.67:1 < 4.5:1）: ${hits.join(", ")}`,
  );

  // text-secondary #4B668A 在全部玻璃底 ≥5.14:1，承接原三处小字
  for (const file of [
    "components/layout/Footer.tsx",
    "components/home/LatestNotes.tsx",
    "app/projects/[slug]/page.tsx",
    "app/articles/page.tsx",
  ]) {
    assert.match(
      readProjectFile(file),
      /text-text-secondary/,
      `${file} 的小字应使用 text-secondary`,
    );
  }
  for (const [bgName, bg] of Object.entries(GLASS_BGS)) {
    assert.ok(
      contrast(hexToRgb("#4B668A"), bg) >= 4.5,
      `text-secondary 对 ${bgName} 需 ≥4.5:1`,
    );
  }
});

/* --------------------------- 标题层级 --------------------------- */

test("标题层级不跳级：/projects 卡片标题 h2（h1 下无中间层级）；首页卡片保持 h3", () => {
  const card = readProjectFile("components/projects/ProjectCard.tsx");
  assert.match(card, /headingLevel\?: "h2" \| "h3"/, "ProjectCard 应支持标题级别配置");
  assert.match(card, /headingLevel = "h3"/, "默认 h3（首页 section 内已有 h2）");
  assert.match(card, /const TitleTag = headingLevel;/);
  assert.doesNotMatch(card, /<h3 className="mt-4/, "不得再硬编码 h3");

  const listPage = readProjectFile("app/projects/page.tsx");
  assert.match(listPage, /headingLevel="h2"/, "/projects 列表页应传 h2（h1 下直接卡片）");
});

test("MY JOURNEY 双形态标题级别：独立形态阶段 h3（版块 h2 下）、嵌套形态 h4（卡内 h3 下）", () => {
  const journey = readProjectFile("components/home/JourneySection.tsx");
  assert.match(journey, /const StageTag = heading \? "h4" : "h3";/);
  assert.match(journey, /<StageTag className=/);
  assert.doesNotMatch(journey, /<h4 className="text-\[15px\]/, "不得再硬编码 h4");

  // 独立形态版块标题由 SectionHeading 承担（h2）
  assert.match(journey, /<SectionHeading eyebrow="My Journey" title="探索与成长" \/>/);
  const sectionHeading = readProjectFile("components/ui/SectionHeading.tsx");
  assert.match(sectionHeading, /<h2 className="font-display/);
});

/* --------------------------- 装饰性 Logo --------------------------- */

test("ButterflyLogo 支持 decorative 模式，三处并存场景全部启用（避免读屏重复播报）", () => {
  const logo = readProjectFile("components/layout/ButterflyLogo.tsx");
  assert.match(logo, /decorative\?: boolean/);
  assert.match(logo, /role=\{decorative \? undefined : "img"\}/);
  assert.match(logo, /aria-hidden=\{decorative \? true : undefined\}/);
  assert.match(logo, /aria-label=\{decorative \? undefined : title\}/);

  // Navbar：品牌链接已有 aria-label + 可见文字；Footer：相邻可见品牌文字；
  // ContactSection：纯视觉点缀。三处都应传 decorative
  for (const [file, marker] of [
    ["components/layout/Navbar.tsx", /decorative/],
    ["components/layout/Footer.tsx", /decorative/],
    ["components/home/ContactSection.tsx", /decorative/],
  ]) {
    assert.match(readProjectFile(file), marker, `${file} 的 Logo 应标记为纯装饰`);
  }
});
