/**
 * 三版块内容契约测试（node:test）：
 * 技术栈 / 文章与实验 / 联系我 —— 校验文案、诚实占位规则与链接边界。
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

test("lib/tech-stack.ts：四组 × 每组四项，名单与参考图一致且每项带配色", () => {
  const data = readProjectFile("lib/tech-stack.ts");

  for (const group of ["前端开发", "后端与数据", "开发工具", "AI 工具链"]) {
    assert.match(data, new RegExp(`name: "${group}"`), `缺少分组 ${group}`);
  }

  const expectedItems = [
    "React", "Next.js", "TypeScript", "Tailwind CSS",
    "Node.js", "Python", "MySQL", "MongoDB",
    "Git", "Docker", "VS Code", "Linux",
    "OpenAI", "Claude", "Cursor", "LangChain",
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

test("LatestNotes：左头部块 + 三张写作计划卡（明确标注，不伪装已发布）", () => {
  const section = readProjectFile("components/home/LatestNotes.tsx");

  assert.match(section, /id="notes"/);
  assert.match(section, /aria-label="文章与实验"/);
  assert.match(section, /Latest Notes/);
  assert.match(section, /文章与实验/);
  assert.match(section, /记录技术选择、设计探索、开发经验与那些值得继续探索的想法。/);
  assert.match(section, /View All/);
  assert.match(section, /href="#notes"/);

  // 空状态说明 + 每条目的「写作计划中」状态徽标（虚线边框，文案由 lib/notes.ts 提供）
  assert.match(section, /当前还没有已发布文章/);
  assert.match(section, /概念视觉/);
  assert.match(section, /border-dashed/);
  assert.match(section, /\{plannedNoteLabel\}/);

  // 诚实边界：不出现参考图里的示意日期与阅读量，卡片不是链接
  assert.doesNotMatch(section, /2024-XX-XX|阅读\s*0|20\d{2}-\d{2}-\d{2}/);
  assert.doesNotMatch(section, /<a[^>]*[\s\S]{0,200}plannedNotes\.map/);
  assert.doesNotMatch(section, emojiPattern);
});

/* ------------------------------- 联系我 ------------------------------- */

test("ContactSection：夜景深色带 + 渠道单源 site.contacts（GitHub 真实链接，其余「待配置」）", () => {
  const section = readProjectFile("components/home/ContactSection.tsx");

  assert.match(section, /id="contact"/);
  assert.match(section, /aria-label="联系我"/);
  assert.match(section, /Contact/);
  assert.match(section, /有一个想法？/);
  assert.match(section, /如果你对我的作品感兴趣，或者有值得一起探索的想法，欢迎通过以下方式联系我。/);
  assert.match(section, /联系我/);
  assert.match(section, /href="\/contact"/);

  // 渠道数据单源 lib/site.ts：GitHub 真实链接（新窗口 + noreferrer），其余挂「待配置」虚线徽标
  assert.match(section, /site\.contacts\.map/);
  assert.match(section, /target="_blank"/);
  assert.match(section, /rel="noreferrer"/);
  const badges = section.match(/待配置/g) ?? [];
  assert.ok(badges.length >= 2, "未接入的渠道应有「待配置」徽标");

  // 诚实边界：组件源码不出现任何账号 / 邮箱 / 外链字面量（真实链接来自 site.ts）
  assert.doesNotMatch(
    section,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@ageha/,
  );
  assert.doesNotMatch(section, /https?:\/\//);
  assert.doesNotMatch(section, emojiPattern);
});

test("ContactSection：夜景视觉与蝴蝶点缀就位，按钮指向 /contact", () => {
  const section = readProjectFile("components/home/ContactSection.tsx");

  // 深海军蓝夜景底 + 星光 + 山脊剪影
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
