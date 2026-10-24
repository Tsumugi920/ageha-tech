/**
 * 项目地基冒烟测试（node:test）：
 * 校验设计令牌、联系占位、版块组装、忽略规则与素材就位。
 * 运行方式：npm test（即 node --test tests/）
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test("globals.css 定义了 --color-sky 等明亮设计令牌与玻璃拟态基础类", () => {
  const css = readProjectFile("app/globals.css");

  // 设计令牌原样采用
  assert.match(css, /--color-sky:\s*#DDF3FF/i);
  assert.match(css, /--color-ice:\s*#F1F8FF/i);
  assert.match(css, /--color-blue:\s*#269DFF/i);
  assert.match(css, /--color-purple:\s*#9C83FF/i);
  assert.match(css, /--shadow-card:\s*0 12px 40px rgba\(71,115,183,0\.12\)/i);

  // 玻璃拟态基础类与冰蓝天空渐变底色
  assert.match(css, /\.glass-panel\s*\{/);
  assert.match(css, /\.glass-card\s*\{/);
  assert.match(css, /backdrop-filter:\s*blur\(/i);
  assert.match(css, /linear-gradient\(/i);
});

test("lib/site.ts 的联系方式一律为「待配置」占位，绝不填真实账号", () => {
  const siteConfig = readProjectFile("lib/site.ts");

  // 每条联系方式都使用「待配置」占位
  const contactMatches = [
    ...siteConfig.matchAll(/\{\s*label:\s*"([^"]+)",\s*value:\s*"([^"]+)"/g),
  ];
  assert.ok(contactMatches.length >= 4, "至少有 4 条联系方式占位");
  for (const [, label, value] of contactMatches) {
    assert.equal(value, "待配置", `${label} 的联系方式应为「待配置」占位`);
  }

  // 品牌、身份与品牌短句就位
  assert.match(siteConfig, /name:\s*"Ageha\.tech"/);
  assert.match(siteConfig, /identity:\s*"INDEPENDENT DIGITAL CREATOR"/);
  assert.match(siteConfig, /brandLine:\s*"Building digital things with curiosity\."/);
});

test("app/page.tsx 依序引用 Hero 等七个版块组件", () => {
  const page = readProjectFile("app/page.tsx");
  const expectedOrder = [
    "Hero",
    "FeaturedProjects",
    "AboutSection",
    "JourneySection",
    "TechStackSection",
    "LatestNotes",
    "ContactSection",
  ];

  let lastIndex = -1;
  for (const component of expectedOrder) {
    const jsxIndex = page.indexOf(`<${component}`);
    assert.ok(
      jsxIndex !== -1 && jsxIndex > lastIndex,
      `${component} 应在 page.tsx 中按顺序渲染`,
    );
    lastIndex = jsxIndex;
  }

  // 六个锚点 id 由各版块组件提供
  for (const component of expectedOrder.slice(1)) {
    assert.match(
      readProjectFile(`components/home/${component}.tsx`),
      new RegExp(`id="(projects|about|journey|tech|notes|contact)"`),
      `${component}.tsx 应带锚点 id`,
    );
  }
});

test(".gitignore 覆盖 node_modules、.next、废案、素材、截图与 tsbuildinfo", () => {
  const gitignore = readProjectFile(".gitignore");
  for (const required of [
    "node_modules/",
    ".next/",
    "Discarded proposal/",
    "_assets/",
    "screenshots/",
    "*.tsbuildinfo",
  ]) {
    assert.ok(
      gitignore.includes(required),
      `.gitignore 应包含 ${required}`,
    );
  }
});

test("public/images/ 下六张参考素材已就位且非空", () => {
  const requiredImages = [
    "hero-clean.png",
    "hero-full.png",
    "cover-agehaos.png",
    "cover-cs.png",
    "cover-moss.png",
    "about-photo.png",
  ];
  for (const image of requiredImages) {
    const imagePath = path.join(projectRoot, "public", "images", image);
    assert.ok(existsSync(imagePath), `缺少 public/images/${image}`);
    assert.ok(statSync(imagePath).size > 0, `public/images/${image} 不应为空`);
  }
});
