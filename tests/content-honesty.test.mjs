/**
 * 内容真实性测试（node:test）：
 * 校验 lib 数据与版块组件的诚实边界 —— 项目数据无外链无日期、
 * 文章条目全部标注「写作计划」、联系方式全部「待配置」占位、
 * 探索时间线不出现任何年份。
 *
 * 断言分两层：
 * - 数据层：直接 import lib/*.ts（Node 24 原生类型剥离）校验真实导出值；
 * - 源码层：正则校验源文件本身，防止字段在类型或注释之外悄然加入。
 * 运行方式：npm test（即 node --test "tests/*.test.mjs"）
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { projects } from "../lib/projects.ts";
import { plannedNotes, plannedNoteLabel } from "../lib/notes.ts";
import { site } from "../lib/site.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

/* 与 lib/content-types.ts 的 Project 类型一一对应的诚实字段白名单 */
const PROJECT_FIELDS = [
  "slug",
  "name",
  "category",
  "description",
  "tags",
  "cover",
  "coverAlt",
  "coverPosition",
  "coverKind",
  "status",
  "links",
];

/* 真实入口链接的域名白名单：只允许站长仓库 README 载明的线上地址与公开源码仓库 */
const PROJECT_LINK_HOST_PATTERNS = [
  /^https:\/\/os\.ageha\.cn\/?$/,
  /^https:\/\/cs\.ageha\.cn\/?$/,
  /^https:\/\/github\.com\/Ageha6912(\/|$)/,
];

/* 与 PlannedNote 类型对应的诚实字段白名单：无日期、无阅读量、无链接 */
const NOTE_FIELDS = ["category", "title", "summary", "motif"];

/* 邮箱 / 社交账号形态（@ageha 覆盖 @handle 式账号写法） */
const accountPattern =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@ageha/;

/* ------------------------------ 项目数据 ------------------------------ */

test("lib/projects.ts：links 仅含白名单域名的真实入口，且只属于已上线项目", () => {
  assert.ok(projects.length > 0, "项目数据不应为空");
  for (const project of projects) {
    const links = project.links ?? [];
    if (project.status === "已上线") {
      assert.ok(links.length > 0, `${project.slug} 已上线，应提供真实入口链接`);
    } else {
      assert.equal(
        links.length,
        0,
        `${project.slug} 没有上线记录，不应渲染任何入口链接`,
      );
    }
    for (const link of links) {
      assert.ok(
        PROJECT_LINK_HOST_PATTERNS.some((pattern) => pattern.test(link.href)),
        `${project.slug} 的入口 ${link.href} 不在真实链接白名单内`,
      );
      assert.equal(link.label.length > 0, true, "入口按钮应有文案");
      assert.equal(link.external, true, "入口应为外链（新窗口打开）");
    }
  }

  // 源码层兜底：项目数据源码中的 http(s) 只能出现在 links 的 href 里
  const source = readProjectFile("lib/projects.ts");
  const outsideLinks = source
    .split("\n")
    .filter((line) => /https?:\/\//.test(line) && !/href:/.test(line));
  assert.deepEqual(outsideLinks, [], "links 之外不应出现任何 http(s) 链接");
});

test("lib/projects.ts：不设日期类字段，字段值不含年份或 ISO 日期", () => {
  for (const project of projects) {
    for (const key of Object.keys(project)) {
      assert.ok(
        PROJECT_FIELDS.includes(key),
        `${project.slug} 出现了诚实字段白名单之外的字段 "${key}"（日期/状态类字段一律不设）`,
      );
    }
    const serialized = JSON.stringify(project);
    assert.doesNotMatch(serialized, /(19|20)\d{2}/, `${project.slug} 不应包含年份`);
    assert.doesNotMatch(serialized, /\d{4}-\d{2}-\d{2}/, `${project.slug} 不应包含 ISO 日期`);
  }

  // 源码层兜底：不允许以任何大小写形式引入 date:/year:/published: 等日期字段
  assert.doesNotMatch(
    readProjectFile("lib/projects.ts"),
    /\b(date|year|published|released|createdAt|updatedAt)\s*:/i,
  );
});

/* ------------------------------ 写作计划 ------------------------------ */

test("lib/notes.ts：条目全部标记「写作计划」，标注由 /articles 路由页逐条渲染", () => {
  assert.match(plannedNoteLabel, /写作计划/, "统一状态标注应含「写作计划」字样");
  assert.ok(plannedNotes.length > 0, "写作计划不应为空");

  // 渲染组件必须真实消费这一标注，而不是只在数据文件里声明
  // （LatestNotes.tsx 退役后，渲染新家为 app/articles/page.tsx）
  const articlesPage = readProjectFile("app/articles/page.tsx");
  assert.match(
    articlesPage,
    /\{plannedNoteLabel\}/,
    "/articles 页应渲染 {plannedNoteLabel}，让每条计划条目都带上「写作计划中」标注",
  );
});

test("lib/notes.ts：写作计划条目无日期、无阅读量、无链接字段", () => {
  for (const note of plannedNotes) {
    for (const key of Object.keys(note)) {
      assert.ok(
        NOTE_FIELDS.includes(key),
        `条目「${note.title}」出现诚实字段白名单之外的字段 "${key}"`,
      );
    }
    const serialized = JSON.stringify(note);
    assert.doesNotMatch(serialized, /(19|20)\d{2}/, `条目「${note.title}」不应包含年份`);
    assert.doesNotMatch(serialized, /\d{4}-\d{2}-\d{2}/, `条目「${note.title}」不应包含 ISO 日期`);
    assert.doesNotMatch(serialized, /https?:\/\//, `条目「${note.title}」不应包含外链`);
  }

  assert.doesNotMatch(
    readProjectFile("lib/notes.ts"),
    /"(?:date|year|views|readCount|readingTime|href|url|link)"\s*:/,
  );
});

/* ------------------------------ 联系方式 ------------------------------ */

test("lib/site.ts：GitHub 为白名单内真实账号，其余渠道保持「待配置」无链接", () => {
  assert.ok(site.contacts.length >= 3, "应至少有 3 条联系方式");
  for (const contact of site.contacts) {
    assert.ok(contact.label.length > 0, "联系方式应有渠道名");
    if (Object.hasOwn(contact, "href")) {
      // 真实账号：必须有非占位值，且域名在白名单内
      assert.notEqual(
        contact.value,
        "待配置",
        `${contact.label} 携带链接时应填真实账号`,
      );
      assert.match(
        contact.href,
        /^https:\/\/github\.com\/Ageha6912\/?$/,
        `${contact.label} 的链接应在真实账号白名单内`,
      );
    } else {
      assert.equal(
        contact.value,
        "待配置",
        `${contact.label} 未接入真实账号前应保持「待配置」占位`,
      );
    }
  }

  // 配置开关就位：只有 configured: true 的入口才会被联系区渲染
  assert.ok(
    site.contacts.every((contact) => typeof contact.configured === "boolean"),
    "每条联系方式都应带 configured 配置开关",
  );
  assert.equal(
    site.contacts.filter((contact) => contact.configured).length,
    1,
    "当前只有 GitHub 一个已配置入口（其余渠道配置后才会展示）",
  );

  // 除白名单域外，全站配置不得出现任何邮箱 / 社交账号 / 外链
  const serialized = JSON.stringify(site);
  const urls = serialized.match(/https?:\/\/[^"]+/g) ?? [];
  assert.ok(urls.length >= 1, "GitHub 真实链接应存在");
  for (const url of urls) {
    assert.match(
      url,
      /^https:\/\/github\.com\/Ageha6912\/?$/,
      `全站配置只允许 GitHub 白名单链接，发现 ${url}`,
    );
  }
  assert.doesNotMatch(serialized, accountPattern, "全站配置不应出现任何邮箱或 @ 账号");
});

test("ContactSection：渠道单源 site.contacts 按 configured 开关渲染，未配置入口直接隐藏", () => {
  const section = readProjectFile("components/home/ContactSection.tsx");

  // 渠道数据单源 lib/site.ts（不在本组件内重复声明渠道清单），
  // 且渲染前按 configured 配置开关过滤——未配置的入口不出现
  assert.match(
    section,
    /site\.contacts\s*\.?\s*\n?\s*\.filter\(\(contact\) => contact\.configured\)/,
    "渠道应经 site.contacts 的 configured 开关统一过滤渲染",
  );
  assert.ok(
    !section.includes('label: "GitHub"'),
    "组件内不应重复硬编码渠道清单",
  );
  // 真实链接：新窗口打开 + noreferrer
  assert.match(section, /target="_blank"/);
  assert.match(section, /rel="noreferrer"/);

  // 诚实边界：未配置入口不渲染——组件不再出现「待配置」占位徽标或虚线样式
  assert.ok(
    !section.includes("待配置"),
    "未配置入口应直接隐藏，而非以「待配置」当正式内容展示",
  );
  assert.doesNotMatch(section, /border-dashed/, "占位虚线徽标应随隐藏一并移除");

  // 组件源码不出现任何邮箱 / 社交账号 / http(s) 外链（链接来自 site.ts）
  assert.doesNotMatch(section, accountPattern);
  assert.doesNotMatch(section, /https?:\/\//);
});

/* ------------------------------ 3D 世界层 ------------------------------ */

test("3D 世界层诚实边界：世界源码不出现白名单外链接与编造宣称", () => {
  // 世界组件与数据层源码不出现任何 http(s) 字面量——真实链接只能来自
  // lib/projects.ts / lib/site.ts 在运行时注入（Moss World 无链接铁律的
  // 世界侧延伸：阶段 2 详情面板 / 彩蛋文案同样受此扫描约束）
  const worldDirs = ["components/world", "lib/world"];
  const offenders = [];
  const scan = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const src = readFileSync(full, "utf8");
        if (/https?:\/\//.test(src)) offenders.push(path.relative(projectRoot, full));
        // 不编造上线状态（状态文案来自 lib/projects.ts 渲染）
        if (/正式发布|已发布|即将上线/.test(src)) offenders.push(`${path.relative(projectRoot, full)}（状态词）`);
      }
    }
  };
  for (const dir of worldDirs) {
    scan(path.join(projectRoot, dir));
  }
  assert.deepEqual(
    offenders,
    [],
    `3D 世界层源码不应出现外链或编造状态词：${offenders.join(", ")}`,
  );
});

/* ------------------------------ 探索时间线 ------------------------------ */

test("JourneySection.tsx：时间线源码不出现任何年份（版权年份在 Footer，不在本断言范围）", () => {
  const source = readProjectFile("components/home/JourneySection.tsx");
  assert.doesNotMatch(
    source,
    /(19|20)\d{2}/,
    "探索时间线不应出现 19xx / 20xx 年份（参考图的年份区间没有依据）",
  );
  assert.doesNotMatch(source, /\d{4}-\d{2}-\d{2}/, "探索时间线不应出现 ISO 日期");

  // 诚实边界的自我声明保留在源码注释中
  assert.ok(
    source.includes("一律不出现任何年份"),
    "应保留「不出现任何年份」的诚实边界注释",
  );

  // 反向锚定：年份集中由 Footer 的版权行承担（© 2026 …）
  assert.match(
    readProjectFile("components/layout/Footer.tsx"),
    /©\s*(19|20)\d{2}/,
    "版权年份应出现在 Footer 版权行",
  );
});
