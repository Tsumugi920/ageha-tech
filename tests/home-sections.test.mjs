/**
 * 项目数据与版块消费冒烟测试（node:test）：
 * 校验项目数据集中管理与诚实边界、共享卡片实现、保留版块（/about 等）
 * 与共享数据不出现年份。首页消费侧契约（阶段 2 完成态）：项目详情面板 /
 * 世界导航面板渲染 lib/projects.ts + lib/site.ts 同源数据（零复制），
 * Moss World 诚实空链；场景内数据由 world-layout.test.mjs 守护。
 * 运行方式：npm test（即 node --test "tests/*.test.mjs"）
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { projects } from "../lib/projects.ts";
import { site } from "../lib/site.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test("lib/projects.ts 集中管理十四个项目，slug、标签与概念占位封面就位", () => {
  const data = readProjectFile("lib/projects.ts");

  // 十四个 slug 齐全
  for (const slug of ["cs-major-archive", "calendar", "blog-cms", "agent-home", "library", "forum", "inventory", "pet-care", "fitness", "ledger", "taskboard", "notes", "recipe-book", "habit-tracker"]) {
    assert.ok(data.includes(`slug: "${slug}"`), `应有 slug ${slug}`);
  }

  // 封面全部为概念视觉占位，指向 public/images/ 下真实存在的插画文件
  assert.ok(
    existsSync(path.join(projectRoot, "public", "images", "hero-clean.png")),
    "缺少 public/images/hero-clean.png",
  );
  assert.ok(data.includes("/images/hero-clean.png"), "应引用 /images/hero-clean.png 占位图");
  assert.equal((data.match(/coverKind: "concept"/g) ?? []).length, 14, "十四张封面应均为概念视觉占位");

  // 技术标签来自各项目核实过的实际套路
  for (const tag of [
    "Node.js",
    "Express",
    "HTML/CSS/JS",
    "localStorage",
    "JavaScript",
    "Next.js",
  ]) {
    assert.ok(data.includes(`"${tag}"`), `应包含标签 ${tag}`);
  }
});

test("项目状态与入口链接如实：可本地运行，封面一律概念视觉占位，链接只在白名单内", () => {
  const data = readProjectFile("lib/projects.ts");

  // 只允许两种有据可查的状态词
  for (const banned of ["正式发布", "已发布", "demoUrl", "sourceUrl", "liveUrl"]) {
    assert.ok(!data.includes(banned), `项目数据不应出现 ${banned}`);
  }
  assert.ok(
    data.includes('status: "可本地运行"'),
    "全部作品均为可本地运行（本地 Node 服务或静态页）",
  );

  // 十四张封面全部为概念视觉占位
  assert.equal((data.match(/coverKind: "concept"/g) ?? []).length, 14, "十四张封面应均为概念视觉占位");
  assert.ok(
    data.includes("概念视觉占位"),
    "项目封面应如实标注为概念视觉占位",
  );

  // 真实入口链接（域名白名单）：只允许助手 GitHub 账号
  const linkHosts = [...data.matchAll(/href: "(https?:\/\/[^"]+)"/g)].map(
    (match) => match[1],
  );
  for (const href of linkHosts) {
    assert.match(
      href,
      /^https:\/\/github\.com\/Tsumugi920(\/|$)/,
      `入口链接 ${href} 不在真实链接白名单内`,
    );
  }
});

test("保留版块源文件与共享数据一律不出现年份或时间区间", () => {
  // FeaturedProjects / LatestNotes 已退役；名单收窄到保留文件
  const files = [
    "components/projects/ProjectCard.tsx",
    "components/home/AboutSection.tsx",
    "components/home/JourneySection.tsx",
    "lib/content-types.ts",
  ];
  for (const file of files) {
    const src = readProjectFile(file);
    assert.ok(
      !/\b(?:19|20)\d{2}\b/.test(src),
      `${file} 不应出现任何年份`,
    );
    assert.ok(!src.includes("至今"), `${file} 不应出现「至今」等时间定位`);
  }
  // 例外：lib/projects.ts 中唯一允许的年份是 CS MAJOR ARCHIVE 核实过的档案范围
  const projectSrc = readProjectFile("lib/projects.ts");
  assert.ok(projectSrc.includes("2013—2026"), "应注明档案范围 2013—2026");
  assert.ok(!projectSrc.includes("至今"), "lib/projects.ts 不应出现「至今」等时间定位");
});

test("ProjectCard：共享卡片唯一实现，诚实标注与 slug 链接就位", () => {
  const src = readProjectFile("components/projects/ProjectCard.tsx");

  assert.match(src, /from "next\/image"/, "封面应使用 next/image");
  assert.match(src, /priority = false/, "priority 应默认关闭（列表懒加载）");
  assert.ok(
    (src.match(/概念视觉占位/g) || []).length >= 1,
    "封面图上应有「概念视觉占位」小徽标",
  );
  assert.ok(
    src.includes("alt={project.coverAlt}"),
    "封面 alt 应如实引用 coverAlt",
  );
  assert.ok(
    src.includes("href={`/projects/${project.slug}`}"),
    "卡片箭头应链接 /projects/<slug>",
  );
  assert.ok(src.includes("line-clamp-4"), "描述应为四行兜底（15px 字号下完整容纳现有文案）");
  assert.ok(
    src.includes("project.tags.map"),
    "应渲染技术标签",
  );
  // 诚实边界：卡片不渲染演示 / 源码链接等虚构字段
  assert.doesNotMatch(src, /demoUrl|sourceUrl|liveUrl|https?:\/\//);
});

test("AboutSection：通栏玻璃板四区结构、三句文案与概念插画标注就位", () => {
  const src = readProjectFile("components/home/AboutSection.tsx");

  assert.match(src, /id="about"/, "应带 about 锚点（/about 路由页消费）");
  assert.match(src, /About Me/i, "应有 ABOUT ME eyebrow");
  assert.ok(src.includes("关于我"), "应有版块标题");
  for (const sentence of [
    "我做小而可用的网页工具和实验项目。",
    "套路固定：原生前端 + Node.js + Express + data.json，或者纯静态 localStorage，不用数据库。",
    "把一些有趣的想法变成现实。",
  ]) {
    assert.ok(src.includes(sentence), `应包含文案：${sentence}`);
  }
  assert.ok(src.includes("了解更多"), "应有「了解更多」按钮");
  assert.ok(src.includes("/about"), "按钮应链接 /about");
  assert.ok(src.includes("/images/about-photo.png"), "应引用插画照片素材");
  assert.ok(src.includes("概念插画 · 非真实照片"), "照片应如实标注为概念插画");
  for (const fact of ["开发者", "兴趣方向", "个人理念"]) {
    assert.ok(src.includes(`"${fact}"`), `应包含条目 ${fact}`);
  }
  assert.match(src, /lg:grid-cols-\[0\.9fr_1\.2fr_1fr\]/, "桌面应为三栏横排（文字 / 视觉图 / 方向+时间线）");
  assert.ok(!src.includes("GlassPanel"), "关于我不应再把整段包进巨型玻璃板");
});

test("JourneySection：三阶段时间线就位，桌面嵌套 About、移动端独立成块", () => {
  const src = readProjectFile("components/home/JourneySection.tsx");

  assert.match(src, /id="journey"/, "应带 journey 锚点");
  assert.match(src, /My Journey/i, "应有 MY JOURNEY 面板标题");
  assert.ok(src.includes("探索与成长"), "移动端应有「探索与成长」标题");
  for (const [title, desc] of [
    ["探索", "学习 Web 前端与小工具构建"],
    ["进阶", "原生前端 + Node.js + Express + data.json 的套路"],
    ["总结", "沉淀方法，持续打磨作品"],
  ]) {
    assert.ok(
      src.includes(`title: "${title}"`) && src.includes(desc),
      `阶段「${title}」及描述应就位`,
    );
  }

  // 双形态：嵌套（桌面）与独立（移动），锚点 id 全页唯一
  assert.ok(src.includes("nested"), "应支持 nested 嵌套形态");
  assert.match(src, /lg:hidden/, "独立形态应在桌面隐藏，避免时间线重复");
  assert.equal(
    (src.match(/id="journey"/g) || []).length,
    1,
    'id="journey" 只应出现一次',
  );
});

test("AboutSection 以 nested 形态嵌套 JourneySection，两版块锚点互不重复", () => {
  const about = readProjectFile("components/home/AboutSection.tsx");
  const journey = readProjectFile("components/home/JourneySection.tsx");

  assert.ok(
    about.includes("<JourneySection nested />"),
    "桌面端应在 About 大板最右列嵌套 JourneySection",
  );
  assert.ok(
    !about.includes('id="journey"'),
    "AboutSection 不应渲染 journey 锚点",
  );
  assert.ok(
    !journey.includes('id="about"'),
    "JourneySection 不应渲染 about 锚点",
  );
});

test("lib/content-types.ts 提供共享类型且数据层按类型声明", () => {
  const types = readProjectFile("lib/content-types.ts");
  for (const typeName of ["Project", "AboutFact", "JourneyStage"]) {
    assert.ok(
      types.includes(`export type ${typeName}`),
      `应导出类型 ${typeName}`,
    );
  }
  assert.ok(
    readProjectFile("lib/projects.ts").includes('from "./content-types"'),
    "projects.ts 应复用共享类型",
  );
});

/* ---------------- 世界信息层（阶段 2）：详情面板 / 导航面板数据单源 ---------------- */

test("ProjectDetailPanel：lib/projects.ts 原对象直渲染，封面 next/image 懒加载", () => {
  const panel = readProjectFile("components/world/ui/ProjectDetailPanel.tsx");

  // 数据单源：组件不重复声明项目数据，从 projects 检索后逐字段渲染
  assert.match(panel, /from "@\/lib\/projects"/, "应导入 lib/projects.ts");
  assert.match(panel, /projects\.find/, "应从数据源检索当前项目");
  for (const field of [
    "project.name",
    "project.category",
    "project.description",
    "project.coverAlt",
    "project.status",
  ]) {
    assert.ok(panel.includes(`{${field}}`), `应渲染 ${field}`);
  }
  assert.match(panel, /project\.tags\.map/, "应遍历渲染技术栈标签");
  assert.match(panel, /src=\{project\.cover\}/, "封面应来自 project.cover");

  // 封面 next/image（routes 口径）：fill + 懒加载，不出现 priority
  assert.match(panel, /from "next\/image"/, "封面应使用 next/image");
  assert.match(panel, /fill/, "封面应 fill 适配面板容器");
  assert.ok(!panel.includes("priority"), "面板封面应懒加载（非首屏大图）");
  assert.match(
    panel,
    /project\.coverPosition \?\? "center"/,
    "竖版封面应沿用 coverPosition 裁切口径",
  );

  // 链接只来自 project.links（运行时注入，组件内零链接字面量）
  assert.match(panel, /projectLinks\.map/, "链接应遍历 project.links 渲染");
  assert.doesNotMatch(panel, /https?:\/\//, "组件源码不得出现链接字面量");

  // 路由双保险：「在详情页打开」→ /projects/[slug]
  assert.match(panel, /href=\{`\/projects\/\$\{project\.slug\}`\}/, "应链接详情页路由");

  // 关闭语义：Esc / × / 返回探索（世界状态保持）
  assert.match(panel, /返回探索/, "应有「返回探索」关闭按钮");
  assert.match(panel, /aria-label="关闭详情，返回探索"/, "关闭按钮应有可访问名称");
});

test("ProjectDetailPanel 诚实边界：无链接项目如实说明，不渲染入口按钮", () => {
  const panel = readProjectFile("components/world/ui/ProjectDetailPanel.tsx");
  // 空链接 → 诚实文案（不编造入口；Moss World links 为空数组）
  assert.match(
    panel,
    /本地项目 · 未公开上线，暂无公开链接/,
    "无链接项目应显示诚实说明",
  );
  // 渲染分支：links 非空才渲染链接按钮（空数组走说明文案）
  assert.match(
    panel,
    /projectLinks\.length > 0/,
    "链接按钮应按 projectLinks 非空条件渲染",
  );
  // 数据级复核：lib/projects.ts 中 agent-home 确无 links 字段值（不拼猜测仓库链接）
  const agentHome = projects.find((project) => project.slug === "agent-home");
  assert.equal((agentHome?.links ?? []).length, 0, "agent-home 数据层应无任何链接");
});

test("WorldNavPanel：传送卡 + 站点路由单源 site.navItems + 联系入口按 configured 过滤", () => {
  const nav = readProjectFile("components/world/ui/WorldNavPanel.tsx");

  // 三项目传送卡：数据单源 lib/projects.ts + PROJECT_ISLES（slug 关联）
  assert.match(nav, /from "@\/lib\/projects"/, "应导入 lib/projects.ts");
  assert.match(nav, /PROJECT_ISLES\.map/, "传送卡应遍历 PROJECT_ISLES");
  assert.match(nav, /projects\.find/, "卡片文案应从项目数据检索（名称/状态）");
  assert.match(nav, /requestTeleport/, "传送动作应走 TeleportSystem 请求");
  assert.match(nav, /openDetail/, "应提供「详情」直达入口");
  assert.match(nav, /快捷键/, "传送卡应标注 1/2/3 快捷键提示");

  // 回航与茧居所（发现后出现——隐藏彩蛋纪律）
  assert.match(nav, /teleportAndClose\("spawn"\)/, "应有主岛回航传送");
  assert.match(nav, /nookDiscovered/, "茧居所入口应按发现状态条件渲染");

  // 站点路由：数据单源 site.navItems + contactRoute（不在组件内另立清单）
  assert.match(nav, /from "@\/lib\/site"/, "应导入 lib/site.ts");
  assert.match(nav, /site\.navItems/, "路由链接应遍历 site.navItems");
  assert.match(nav, /site\.contactRoute/, "联系页应来自 site.contactRoute（与 Navbar 同源）");
  assert.doesNotMatch(nav, /href="\/(about|tech|contact|articles)"/, "不得硬编码路由清单");

  // 联系入口：configured 过滤 + 外链新窗口（链接运行时来自 site.contacts）
  assert.match(
    nav,
    /site\.contacts\s*\n?\s*\.filter\(\(contact\) => contact\.configured && contact\.href\)/,
    "联系入口应按 configured 开关过滤",
  );
  assert.match(nav, /target="_blank"/);
  assert.match(nav, /rel="noreferrer"/);
  assert.doesNotMatch(nav, /https?:\/\//, "组件源码不得出现链接字面量");

  // 数据级复核：导航面板过滤后应恰好渲染 GitHub 一个联系入口
  assert.equal(
    site.contacts.filter((contact) => contact.configured && contact.href).length,
    1,
  );
});

test("HelpPanel：键位说明随时可查，触屏与桌面双形态，提供跳过探索入口", () => {
  const help = readProjectFile("components/world/ui/HelpPanel.tsx");
  assert.match(help, /键位/, "应有键位说明区");
  assert.match(help, /<kbd>/, "键位应用 kbd 语义标注");
  for (const key of ["E", "M", "H", "Esc", "查看"]) {
    assert.ok(help.includes(key), `说明应覆盖 ${key}`);
  }
  assert.match(help, /isMobileLike/, "应按设备形态切换触屏手势 / 桌面键位");
  assert.match(help, /跳过探索，直接看项目列表/, "应有跳过探索入口（3D 不是门槛）");
  assert.match(help, /href="\/projects"/, "跳过探索应链接项目列表页");
  assert.match(help, /aria-label="关闭操作说明"/, "关闭按钮应有可访问名称");
});
