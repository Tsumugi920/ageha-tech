/**
 * 版块内容契约测试（node:test）：
 * 技术栈 / 文章与实验（写作计划渲染新家：/articles 路由页） / 联系我 ——
 * 校验文案、诚实占位规则与链接边界。
 * LatestNotes.tsx 已退役（蓝图 §14.0）：其「写作计划条目渲染」断言
 * 迁移至 app/articles/page.tsx（本文件 + content-honesty.test.mjs 双守护）。
 * 运行方式：npm test（即 node --test tests/*.test.mjs）
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

const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

/* ------------------------------- 技术栈 ------------------------------- */

test("lib/tech-stack.ts：四组 × 每组四项，名单与助手实际套路一致且每项带配色", () => {
  const data = readProjectFile("lib/tech-stack.ts");

  for (const group of ["前端开发", "后端与数据", "开发工具", "在做的方向"]) {
    assert.match(data, new RegExp(`name: "${group}"`), `缺少分组 ${group}`);
  }

  const expectedItems = [
    "原生 HTML / CSS / JS", "React", "Next.js", "Tailwind CSS",
    "Node.js", "Express", "JSON 文件存储", "localStorage",
    "Git", "GitHub", "VS Code", "Linux",
    "网页小工具", "数据档案", "交互实验", "静态站点",
  ];
  for (const name of expectedItems) {
    assert.match(data, new RegExp(`name: "${name.replace(".", "\\.")}"`), `缺少技术项 ${name}`);
  }

  // 每项均有品牌近色值（#RRGGBB）
  const colorCount = (data.match(/color: "#[0-9A-Fa-f]{6}"/g) ?? []).length;
  assert.equal(colorCount, 16, "16 个技术项都应带 color 配色");

  // 诚实边界：明确声明不附带熟练度/年限，且无等级声明字样
  assert.match(data, /不附带任何熟练度、年限或认证声明/);
  assert.doesNotMatch(data, /精通|资深|Expert|Master/);
});

test("TechStackSection：头部行（eyebrow/标题/行内副题/查看更多→/tech）+ 四组图标矩阵", () => {
  const section = readProjectFile("components/home/TechStackSection.tsx");

  assert.match(section, /id="tech"/);
  assert.match(section, /aria-label="技术栈"/);
  assert.match(section, /\{?"Tech Stack"|\{eyebrow|\>Tech Stack\</);
  assert.match(section, /技术栈/);
  assert.match(section, /通过真实项目积累经验，以持续学习拓展能力边界。/);
  assert.match(section, /查看更多/);
  assert.match(section, /href="\/tech"/);

  // 16 个 icon 键全部在统一映射表中（lucide 统一尺寸与风格）
  const keys = [
    "atom", "layers", "file-type", "wind",
    "hexagon", "worm", "database", "leaf",
    "git-branch", "container", "square-code", "terminal",
    "flower", "asterisk", "box", "shell",
  ];
  for (const key of keys) {
    assert.match(
      section,
      new RegExp(`"?${key}"?:`),
      `映射表缺少 icon 键 ${key}`,
    );
  }

  // 白玻璃子卡 + 品牌色点缀（每项颜色以内联 style 上色）
  assert.match(section, /glass-card rounded-2xl/);
  assert.match(section, /backgroundColor: `\$\{item\.color\}14`/);
  assert.doesNotMatch(section, emojiPattern);
});

/* ----------------------------- 文章与实验 ----------------------------- */

test("lib/notes.ts：三条写作计划条目，无日期、无阅读量字段", () => {
  const data = readProjectFile("lib/notes.ts");

  for (const title of [
    "从零搭建一个现代化的个人网站",
    "如何选择适合自己的技术栈",
    "交互设计中的微动效实践",
  ]) {
    assert.match(data, new RegExp(title), `缺少写作计划条目 ${title}`);
  }
  for (const category of ["技术笔记", "产品思考", "设计探索"]) {
    assert.match(data, new RegExp(`"${category}"`));
  }
  for (const motif of ["lake", "city", "aurora"]) {
    assert.match(data, new RegExp(`motif: "${motif}"`));
  }

  // 诚实边界：数据结构里根本没有日期 / 阅读量 / 链接字段
  assert.match(data, /不含日期、阅读量与链接/);
  assert.match(data, /写作计划中/);
  assert.doesNotMatch(data, /20\d{2}-\d{2}|"date"|"views"|"readCount"|href:/);
});

test("文章与实验页（写作计划渲染新家）：空状态 + 三张计划卡明确标注，不伪装已发布", () => {
  const page = readProjectFile("app/articles/page.tsx");

  assert.match(page, /当前还没有已发布文章/);
  assert.match(page, /Latest Notes|Articles/, "页头 eyebrow 应就位");
  assert.match(page, /文章与实验/);
  assert.match(page, /记录技术选择、设计探索、开发经验与那些值得继续探索的想法。/);
  assert.match(page, /\{plannedNotes\.map/, "应渲染写作计划条目");

  // 每条目的「写作计划中」状态徽标（虚线边框，文案由 lib/notes.ts 提供）
  assert.match(page, /border-dashed/);
  assert.match(page, /\{plannedNoteLabel\}/);
  assert.match(page, /概念视觉/, "缩略图应如实标注概念视觉");

  // 诚实边界：不出现示意日期与阅读量，卡片不是链接
  assert.doesNotMatch(page, /2024-XX-XX|阅读\s*0|20\d{2}-\d{2}-\d{2}/);
  assert.doesNotMatch(page, /<a[^>]*[\s\S]{0,200}plannedNotes\.map/);
  assert.doesNotMatch(page, emojiPattern);
});

/* ------------------------------- 联系我 ------------------------------- */

test("ContactSection：暮光天幕版块 + 渠道单源 site.contacts（GitHub 真实链接，未配置入口隐藏）", () => {
  const section = readProjectFile("components/home/ContactSection.tsx");

  assert.match(section, /id="contact"/);
  assert.match(section, /aria-label="联系我"/);
  assert.match(section, /Contact/);
  assert.match(section, /有一个想法？/);
  assert.match(section, /如果你对我的作品感兴趣，或者有值得一起探索的想法，欢迎通过以下方式联系我。/);
  assert.match(section, /联系我/);
  assert.match(section, /href="\/contact"/);

  // 渠道数据单源 lib/site.ts：GitHub 真实链接（新窗口 + noreferrer）；
  // 未配置渠道按 configured 开关直接隐藏，不以「待配置」占位展示
  assert.match(section, /site\.contacts\s*\.?\s*\n?\s*\.filter\(\(contact\) => contact\.configured\)/);
  assert.match(section, /target="_blank"/);
  assert.match(section, /rel="noreferrer"/);
  assert.ok(
    !section.includes("待配置"),
    "未配置入口应直接隐藏，而非以「待配置」当正式内容展示",
  );

  // 诚实边界：组件源码不出现任何账号 / 邮箱 / 外链字面量（真实链接来自 site.ts）
  assert.doesNotMatch(
    section,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@ageha/,
  );
  assert.doesNotMatch(section, /https?:\/\//);
  assert.doesNotMatch(section, emojiPattern);
});

test("ContactSection：暮光视觉与蝴蝶点缀就位，按钮指向 /contact", () => {
  const section = readProjectFile("components/home/ContactSection.tsx");

  // 暮光天幕：冰蓝 → 蓝紫 → 深空暮光连续渐变（深海军蓝色标为品牌锚点）
  // + 星尘 + 远山剪影，内容收进浅玻璃幕带（无突兀深色矩形）
  assert.match(section, /#1E3762|#152A50/);
  assert.match(section, /radial-gradient/);
  assert.match(section, /<svg[^>]*viewBox="0 0 1200 340"/);
  assert.match(section, /viewBox="0 0 1200 200"/);
  // 青色渐变胶囊按钮 + 右卡蝴蝶（复用 ButterflyLogo，独立渐变 id）
  assert.match(section, /linear-gradient\(102deg,#3FD9FF/);
  assert.match(section, /ButterflyLogo/);
  assert.match(section, /gradientId="contact-butterfly"/);
  assert.match(section, /Let&apos;s build something amazing together\./);
});
