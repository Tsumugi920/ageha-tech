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
import { readFileSync } from "node:fs";
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

/* 与 lib/content-types.ts 的 Project 类型一一对应的诚实字段白名单：
   刻意不设上线状态、演示/源码链接、日期等字段 */
const PROJECT_FIELDS = [
  "slug",
  "name",
  "category",
  "description",
  "tags",
  "cover",
  "coverAlt",
];

/* 与 PlannedNote 类型对应的诚实字段白名单：无日期、无阅读量、无链接 */
const NOTE_FIELDS = ["category", "title", "summary", "motif"];

/* 邮箱 / 社交账号形态（@ageha 覆盖 @handle 式账号写法） */
const accountPattern =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@ageha/;

/* ------------------------------ 项目数据 ------------------------------ */

test("lib/projects.ts：任何字段都不含 http(s) 外链", () => {
  const source = readProjectFile("lib/projects.ts");
  assert.doesNotMatch(
    source,
    /https?:\/\//,
    "项目数据源码不应出现任何 http(s) 链接",
  );

  assert.ok(projects.length > 0, "项目数据不应为空");
  for (const project of projects) {
    assert.doesNotMatch(
      JSON.stringify(project),
      /https?:\/\//,
      `${project.slug} 的任何字段值都不应包含外链（项目未上线，无演示/源码可链）`,
    );
  }
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

test("lib/notes.ts：条目全部标记「写作计划」，标注由 LatestNotes 逐条渲染", () => {
  assert.match(plannedNoteLabel, /写作计划/, "统一状态标注应含「写作计划」字样");
  assert.ok(plannedNotes.length > 0, "写作计划不应为空");

  // 首页组件必须真实消费这一标注，而不是只在数据文件里声明
  const latestNotes = readProjectFile("components/home/LatestNotes.tsx");
  assert.match(
    latestNotes,
    /\{plannedNoteLabel\}/,
    "LatestNotes 应渲染 {plannedNoteLabel}，让每条计划条目都带上「写作计划中」标注",
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

test("lib/site.ts：联系方式全部「待配置」占位且不携带链接，全站配置无任何账号/外链", () => {
  assert.ok(site.contacts.length >= 3, "应至少有 3 条联系方式占位");
  for (const contact of site.contacts) {
    assert.ok(contact.label.length > 0, "联系方式应有渠道名");
    assert.equal(
      contact.value,
      "待配置",
      `${contact.label} 应为「待配置」占位，接入真实账号前绝不虚构`,
    );
    assert.ok(
      !Object.hasOwn(contact, "href"),
      `${contact.label} 占位不应携带 href 链接`,
    );
  }

  const serialized = JSON.stringify(site);
  assert.doesNotMatch(serialized, accountPattern, "全站配置不应出现任何邮箱或社交账号");
  assert.doesNotMatch(serialized, /https?:\/\//, "全站配置不应出现任何 http(s) 外链");
});

test("ContactSection：渠道全部渲染「待配置」虚线徽标，绝无真实账号或外链", () => {
  const section = readProjectFile("components/home/ContactSection.tsx");

  // 渠道清单：逐条声明、名称不重复，并经 CONTACT_CHANNELS.map 统一渲染徽标
  const labels = [
    ...section.matchAll(/\{\s*label:\s*"([^"]+)",\s*icon:/g),
  ].map((match) => match[1]);
  assert.ok(labels.length >= 3, `应声明至少 3 个联系渠道，实际 ${labels.length}`);
  assert.equal(new Set(labels).size, labels.length, "联系渠道名不应重复");
  assert.match(section, /CONTACT_CHANNELS\.map/, "渠道应经统一映射渲染");
  assert.match(section, /待配置/, "渠道应挂「待配置」占位徽标");
  assert.match(section, /border-dashed/, "占位徽标应为虚线样式（区别于正式链接按钮）");

  // 诚实边界：整个版块源码不出现任何邮箱 / 社交账号 / http(s) 外链
  assert.doesNotMatch(section, accountPattern);
  assert.doesNotMatch(section, /https?:\/\//);
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
