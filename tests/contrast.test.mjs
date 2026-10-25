/**
 * 对比度与可读性测试（node:test）—— 数值级回归。
 *
 * 以 WCAG 2.x 相对亮度公式真实核算（sRGB 线性化 → 亮度 → 对比度），
 * 背景按站点真实叠层做 alpha 合成：
 * - 页面底 sky #DDF3FF / ice #F1F8FF；
 * - 玻璃面板 = 白 48% 叠在页面底上；玻璃卡 = 白 74%；
 * - 导航激活胶囊 = 白 75% 叠在玻璃上；
 * - body::before 氛围斑（fixed，滚动时内容会穿过）取较强的
 *   rgba(38,157,255,0.14) 叠加态作为玻璃底的最坏情况；
 * - 世界 HUD 件（world-hud__* / world-toast）= 白 60%~74% 玻璃底。
 *
 * 阈值：正文/小字 4.5:1，大字（≥24px 或 ≥18.66px bold）3:1，
 * 非文本焦点指示 3:1。运行方式：npm test
 *
 * 【迁移记录】原 hero-gradient-* 渐变文字端点断言与 Hero.tsx 右缘面板断言
 * 随 Hero 退役删除（globals.css hero 专用块已一并移除，HTML 层不再有渐变
 * 文字）；其守护意图（品牌字对玻璃底 ≥3:1 / 正文 ≥4.5:1）由下方
 * 「世界品牌字 / 世界 HUD 深墨文字」断言承接（蓝图 §14.1）。
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

/** 世界 HUD / 引导卡玻璃底（白 60% 与 74% 叠 sky，取最坏一档） */
const WORLD_HUD_BGS = [over(WHITE, 0.6, SKY), over(WHITE, 0.74, SKY)];

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
const textPrimaryRgb = hexToRgb(tokens.get("--color-text-primary"));
const textSecondaryRgb = hexToRgb(tokens.get("--color-text-secondary"));

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

test("文字链接不再使用品牌蓝/品牌紫：查看更多 / 了解更多 / 导航激活全部换加深档", () => {
  const strictFiles = [
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

/* --------------------- 世界品牌字与 HUD（Hero 契约迁移新家） --------------------- */

test("世界品牌字「Ageha.tech」深墨令牌：对 sky / 氛围层 / 加载底 ≥3:1（大字）", () => {
  const brand = readProjectFile("components/world/loading/LoadingScreen.tsx");
  // 品牌标题用 --color-text-primary 深蓝（#10294B），不使用白字
  assert.match(brand, /world-brand__title/);
  const cssRule = css.match(/\.world-brand__title\s*\{([\s\S]*?)\}/);
  assert.ok(cssRule, "globals.css 应有 .world-brand__title 规则");
  assert.match(cssRule[1], /color:\s*var\(--color-text-primary\)/);

  assert.ok(
    contrast(textPrimaryRgb, SKY) >= 3,
    `深蓝对 sky 实测 ${contrast(textPrimaryRgb, SKY).toFixed(2)}:1`,
  );
  // 氛围层（rgba(38,157,255,0.16) 叠 sky，加载屏 ::before 较强处）比 sky 略深
  const loadingAtmosphere = over(hexToRgb("#269DFF"), 0.16, SKY);
  assert.ok(
    contrast(textPrimaryRgb, loadingAtmosphere) >= 3,
    `深蓝对加载屏氛围层实测 ${contrast(textPrimaryRgb, loadingAtmosphere).toFixed(2)}:1`,
  );
  // tagline（secondary，约 15px 正文）在玻璃/天空底上需 ≥4.5:1
  for (const bg of [SKY, ...WORLD_HUD_BGS]) {
    assert.ok(
      contrast(textSecondaryRgb, bg) >= 4.5,
      `tagline 深蓝灰对 HUD 底实测 ${contrast(textSecondaryRgb, bg).toFixed(2)}:1，正文需 ≥4.5:1`,
    );
  }
});

test("世界 HUD / 引导卡 / 信息面板：玻璃底上一律深墨文字，白字仅限深蓝渐变 CTA", () => {
  const cssHud = css;

  // HUD 件与面板文字色只允许消费 text-primary / text-secondary / link 令牌
  // （阶段 2 新增面板类串：详情 / 导航 / 说明三面板 + 诚实空链说明；
  //  阶段 3 新增场景内名牌类串：drei Html 门户内的 .world-nameplate__*）
  for (const cls of [
    "world-hud__zone",
    "world-hud__prompt-btn",
    "world-hud__hint",
    "world-hud__quick-name",
    "world-toast__intro",
    "world-fallback__note",
    "world-panel__title",
    "world-panel__eyebrow",
    "world-detail__desc",
    "world-nav__card-name",
    "world-help__list",
    "world-detail__nolink",
    "world-nameplate__name",
    "world-nameplate__status",
    "world-nameplate__status--live",
  ]) {
    const rule = cssHud.match(new RegExp(`\\.${cls}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(rule, `globals.css 应有 .${cls} 规则`);
    assert.match(
      rule[1],
      /var\(--color-(text-primary|text-secondary|link)\)/,
      `.${cls} 文字应消费深墨 / 加深链接令牌`,
    );
    assert.doesNotMatch(
      rule[1],
      /(?<!-)color:\s*#fff|color:\s*white/,
      `.${cls} 不得使用白色正文`,
    );
  }

  // 数值级：primary / secondary / link 对 HUD 玻璃底全部达标
  for (const [name, fg] of [
    ["text-primary", textPrimaryRgb],
    ["text-secondary", textSecondaryRgb],
    ["link", linkRgb],
  ]) {
    for (const bg of WORLD_HUD_BGS) {
      assert.ok(
        contrast(fg, bg) >= 4.5,
        `${name} 对 HUD 玻璃底实测 ${contrast(fg, bg).toFixed(2)}:1，需 ≥4.5:1`,
      );
    }
  }

  // 场景内名牌（阶段 3）：底为白 88% 玻璃（.world-nameplate），衬底是
  // 3D 画面而非固定 sky——取最坏衬底（深蓝岩 #10294B，全场景最深物质色）
  // 做 alpha 合成核算（68% 玻璃时 text-secondary 仅 3.02:1，已提白修复）
  const nameplateWorstBg = over(WHITE, 0.88, hexToRgb("#10294B"));
  for (const [name, fg] of [
    ["text-primary", textPrimaryRgb],
    ["text-secondary", textSecondaryRgb],
    ["link", linkRgb],
  ]) {
    const ratio = contrast(fg, nameplateWorstBg);
    assert.ok(
      ratio >= 4.5,
      `名牌 ${name} 对最坏衬底（白68%/深蓝岩）实测 ${ratio.toFixed(2)}:1，需 ≥4.5:1`,
    );
  }

  // 白字只允许出现在深蓝渐变 CTA（15px semibold）：
  // 渐变各端点逐个数值核算 ≥4.5:1（浅青渐变白字仅 2.0~3.4:1，已弃用）
  // ——引导卡主按钮（world-toast__primary）与世界面板主按钮
  // （world-panel__primary，阶段 2）同组端点，逐组断言
  for (const ctaClass of ["world-toast__primary", "world-panel__primary"]) {
    const ctaRule = cssHud.match(new RegExp(`\\.${ctaClass}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(ctaRule, `globals.css 应有 .${ctaClass} 规则`);
    assert.match(ctaRule[1], /color:\s*#ffffff/);
    const ctaGradient = ctaRule[1].match(/linear-gradient\(([^)]+)\)/);
    assert.ok(ctaGradient, `.${ctaClass} 应为渐变底`);
    const ctaStops = [...ctaGradient[1].matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) =>
      hexToRgb(m[0]),
    );
    assert.ok(ctaStops.length >= 3, `.${ctaClass} 渐变应至少三个端点`);
    for (const stop of ctaStops) {
      const ratio = contrast(WHITE, stop);
      assert.ok(
        ratio >= 4.5,
        `.${ctaClass} 端点 rgb(${stop.r},${stop.g},${stop.b}) 对白字实测 ${ratio.toFixed(2)}:1，15px semibold 需 ≥4.5:1`,
      );
    }
  }
});

/* --------------------------- 统计口径对齐 --------------------------- */

test("引导卡统计口径与站内可数内容逐项对齐：16 = 技术项实数，3+ = 项目实数", () => {
  const toast = readProjectFile("components/world/ui/IntroToast.tsx");
  const techItemCount = techGroups.reduce((sum, group) => sum + group.items.length, 0);

  // 16 项在用/在学技术 = lib/tech-stack.ts 四组 × 四项的真实计数
  assert.match(
    toast,
    new RegExp(`\\{ value: "${techItemCount}", label: "在用\\/在学技术" \\}`),
    `统计值应等于 techGroups 实际技术项数 ${techItemCount}`,
  );
  assert.ok(techItemCount > 0 && techGroups.length === 4, "技术栈应为四组真实数据");

  // 3+ 代表项目 = lib/projects.ts 项目数（3+ 为「以上」语义，允许 ≥）
  assert.match(
    toast,
    new RegExp(`\\{ value: "${projects.length}\\+", label: "代表项目" \\}`),
    `统计值应与 projects.length = ${projects.length} 一致`,
  );

  // 不得回退到不可数的「5+ 技术领域」式表述
  assert.doesNotMatch(toast, /5\+/);
  assert.doesNotMatch(toast, /技术领域/);
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

  // text-secondary #4B668A 在全部玻璃底 ≥5.14:1，承接小字
  for (const file of [
    "components/layout/Footer.tsx",
    "app/projects/[slug]/page.tsx",
    "app/articles/page.tsx",
    "components/world/ui/IntroToast.tsx",
  ]) {
    assert.match(
      readProjectFile(file),
      /text-text-secondary|world-toast__label|color-text-secondary|--color-text-secondary/,
      `${file} 的小字应使用 text-secondary 令牌`,
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

test("标题层级不跳级：/projects 卡片标题 h2（h1 下无中间层级）；卡片默认 h3", () => {
  const card = readProjectFile("components/projects/ProjectCard.tsx");
  assert.match(card, /headingLevel\?: "h2" \| "h3"/, "ProjectCard 应支持标题级别配置");
  assert.match(card, /headingLevel = "h3"/, "默认 h3（世界降级页等 section 内已有 h2）");
  assert.match(card, /const TitleTag = headingLevel;/);
  assert.doesNotMatch(card, /<h3 className="mt-4/, "不得再硬编码 h3");

  const listPage = readProjectFile("app/projects/page.tsx");
  assert.match(listPage, /headingLevel="h2"/, "/projects 列表页应传 h2（h1 下直接卡片）");

  // 世界降级页：h2 标题下卡片保持 h3（首页 h1 由 WorldShell 品牌标头承担）
  const fallback = readProjectFile("components/world/ui/FallbackProjects.tsx");
  assert.match(fallback, /headingLevel="h3"/);
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

test("ButterflyLogo 支持 decorative 模式，多场景并存全部启用（避免读屏重复播报）", () => {
  const logo = readProjectFile("components/layout/ButterflyLogo.tsx");
  assert.match(logo, /decorative\?: boolean/);
  assert.match(logo, /role=\{decorative \? undefined : "img"\}/);
  assert.match(logo, /aria-hidden=\{decorative \? true : undefined\}/);
  assert.match(logo, /aria-label=\{decorative \? undefined : title\}/);

  // Navbar：品牌链接已有 aria-label + 可见文字；Footer：相邻可见品牌文字；
  // ContactSection：纯视觉点缀；世界加载屏：纯视觉品牌。全部应传 decorative
  for (const [file, marker] of [
    ["components/layout/Navbar.tsx", /decorative/],
    ["components/layout/Footer.tsx", /decorative/],
    ["components/home/ContactSection.tsx", /decorative/],
    ["components/world/loading/LoadingScreen.tsx", /decorative/],
  ]) {
    assert.match(readProjectFile(file), marker, `${file} 的 Logo 应标记为纯装饰`);
  }
});
