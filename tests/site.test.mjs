/**
 * 项目地基冒烟测试（node:test）：
 * 校验设计令牌、联系占位、首页世界入口组装（原「七版块顺序」断言的
 * 迁移新形态：page.tsx 渲染 WorldShell + lib/world 数据模块就位）、
 * 忽略规则与素材就位。
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

test("lib/site.ts 的联系方式：GitHub 为白名单真实账号，其余渠道「待配置」", () => {
  const siteConfig = readProjectFile("lib/site.ts");

  // 每条联系方式：真实账号必须带白名单链接；占位必须保持「待配置」
  const contactMatches = [
    ...siteConfig.matchAll(
      /\{\s*label:\s*"([^"]+)",\s*value:\s*"([^"]+)"(?:,\s*href:\s*"([^"]+)")?/g,
    ),
  ];
  assert.ok(contactMatches.length >= 3, "至少有 3 条联系方式");
  for (const [, label, value, href] of contactMatches) {
    if (href) {
      assert.match(
        href,
        /^https:\/\/github\.com\/Tsumugi920\/?$/,
        `${label} 的链接应在真实账号白名单内`,
      );
      assert.notEqual(value, "待配置", `${label} 携带链接时应填真实账号`);
    } else {
      assert.equal(value, "待配置", `${label} 未接入前应为「待配置」占位`);
    }
  }
  assert.ok(
    siteConfig.includes('label: "GitHub"') && siteConfig.includes("Ageha6912"),
    "GitHub 应为助手真实账号 Tsumugi920",
  );

  // 品牌、身份与品牌短句就位
  assert.match(siteConfig, /name:\s*"Momori"/);
  assert.match(siteConfig, /identity:\s*"MOMORI · PERSONAL SITE"/);
  assert.match(siteConfig, /brandLine:\s*"Small useful web tools, made and kept by Momori\."/);
});

test("app/page.tsx 渲染 WorldShell，lib/world 数据模块与关键世界组件就位", () => {
  const page = readProjectFile("app/page.tsx");
  assert.match(
    page,
    /import \{ WorldShell \} from "@\/components\/world\/WorldShell"/,
    "首页应渲染世界入口 WorldShell",
  );
  assert.ok(page.includes("<WorldShell />"));

  // 世界数据模块（原七版块断言的迁移新形态）
  for (const moduleName of ["constants", "layout", "colliders", "performance"]) {
    const file = path.join(projectRoot, "lib", "world", `${moduleName}.ts`);
    assert.ok(existsSync(file), `缺少 lib/world/${moduleName}.ts`);
    assert.ok(statSync(file).size > 0, `lib/world/${moduleName}.ts 不应为空`);
  }
  // 关键世界组件（场景 / 控制 / HUD / 降级）
  for (const component of [
    "components/world/WorldCanvas.tsx",
    "components/world/systems/usePlayerController.ts",
    "components/world/systems/FollowCamera.tsx",
    "components/world/ui/HudOverlay.tsx",
    "components/world/ui/FallbackProjects.tsx",
  ]) {
    assert.ok(
      existsSync(path.join(projectRoot, component)),
      `缺少 ${component}`,
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

test("public/images/ 下三张素材已就位且非空（参考素材）", () => {
  const requiredImages = [
    "hero-clean.png",
    "hero-full.png",
    "about-photo.png",
  ];
  for (const image of requiredImages) {
    const imagePath = path.join(projectRoot, "public", "images", image);
    assert.ok(existsSync(imagePath), `缺少 public/images/${image}`);
    assert.ok(statSync(imagePath).size > 0, `public/images/${image} 不应为空`);
  }
});
