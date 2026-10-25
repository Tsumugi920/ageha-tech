/**
 * 世界资产纪律测试（node:test）—— 阶段 1 基础断言：
 * - 全部世界渲染组件为客户端组件（SSR 安全）；
 * - 场景源码禁 troika <Text>（离线构建红线）、禁外链字体 / 纹理；
 * - world DOM 层无裸 <img>（对齐 routes.test.mjs 全站契约，§11.1）；
 * - 纹理引用只允许 public/world 与 public/images（阶段 2 起生效的扫描先就位）；
 * - lib/world 保持纯 TS（无 three 依赖，node --test 可直接导入）。
 *
 * 阶段 2 将扩展：prepare-world-assets.mjs 存在性 + §11.2 产物
 * statSync 体积上限断言（蓝图 §14.1 world-assets 行）。
 * 运行方式：npm test
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

/** 递归收集目录下指定后缀文件（相对路径，正斜杠） */
function collectFiles(dir, suffixes, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, suffixes, acc);
    else if (suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      acc.push(path.relative(projectRoot, full).replaceAll("\\", "/"));
    }
  }
  return acc;
}

const WORLD_TSX = collectFiles(path.join(projectRoot, "components", "world"), [".tsx"]);
const WORLD_ALL = collectFiles(path.join(projectRoot, "components", "world"), [".ts", ".tsx"]);

test("世界组件全部就位且均为客户端组件（SSR 安全）", () => {
  assert.ok(WORLD_TSX.length >= 10, `世界组件应已就位（实际 ${WORLD_TSX.length} 个 .tsx）`);
  for (const file of WORLD_TSX) {
    const src = readProjectFile(file);
    assert.match(
      src,
      /^"use client";/,
      `${file} 应以 "use client" 开头（3D 渲染组件 SSR 安全）`,
    );
  }
});

test("场景源码禁 troika <Text> 与外链字体（离线构建红线，蓝图 §11.1）", () => {
  for (const file of WORLD_ALL) {
    const src = readProjectFile(file);
    // drei 导入白名单：Html / useProgress 等工具，禁 <Text>（默认拉 CDN Roboto）
    const dreiImports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["@']@react-three\/drei["']/g)];
    for (const match of dreiImports) {
      const names = match[1].split(",").map((name) => name.trim().split(" as ")[0]);
      for (const name of names) {
        assert.notEqual(
          name,
          "Text",
          `${file} 不得从 drei 导入 Text（troika 拉取 CDN 字体）`,
        );
      }
    }
    assert.doesNotMatch(src, /fonts\.googleapis|fonts\.gstatic|@fontsource/, `${file} 不得引用外链字体`);
  }
});

test("世界源码与数据层零外部 URL（外链纹理 / CDN 一律禁止）", () => {
  const offenders = [];
  for (const file of [
    ...WORLD_ALL,
    ...collectFiles(path.join(projectRoot, "lib", "world"), [".ts"]),
  ]) {
    if (/https?:\/\//.test(readProjectFile(file))) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `以下世界文件包含外部 URL：${offenders.join(", ")}`);
});

test("world DOM 层无裸 <img>（图片一律 next/image，对齐全站契约）", () => {
  for (const file of WORLD_TSX) {
    const src = readProjectFile(file);
    assert.ok(!/<img[\s>]/.test(src), `${file} 不应出现裸 <img>`);
    if (/<Image[\s>]/.test(src)) {
      assert.ok(src.includes('from "next/image"'), `${file} 应从 next/image 引入 Image`);
    }
  }
});

test("纹理引用只允许 public/world 与 public/images 前缀（阶段 2 起的贴图纪律）", () => {
  for (const file of WORLD_ALL) {
    const src = readProjectFile(file);
    const textureRefs = [...src.matchAll(/(?:useTexture\(\s*|src=["'])([^"')]+)/g)]
      .map((match) => match[1])
      .filter((ref) => ref.startsWith("/") || ref.startsWith("http"));
    for (const ref of textureRefs) {
      assert.ok(
        ref.startsWith("/world/") || ref.startsWith("/images/"),
        `${file} 的纹理/图片引用 ${ref} 应指向 public/world 或 public/images`,
      );
    }
  }
});

test("lib/world 为纯 TS 数据层（无 three 依赖），public/world 目录已预留", () => {
  for (const file of collectFiles(path.join(projectRoot, "lib", "world"), [".ts"])) {
    const src = readProjectFile(file);
    assert.ok(!src.includes('from "three"'), `${file} 不应依赖 three`);
    assert.ok(statSync(path.join(projectRoot, file)).size > 0, `${file} 不应为空`);
  }
  // 阶段 2 产物目录占位说明（脚本与产物断言在阶段 2 扩展）
  const worldAssetsDir = path.join(projectRoot, "public", "world");
  if (existsSync(worldAssetsDir)) {
    // 已有产物时只允许 world/screens、world/gallery、蝶精灵与概念图四类
    for (const entry of readdirSync(worldAssetsDir)) {
      assert.match(
        entry,
        /^(screens|gallery|butterfly-sprite-512\.png|concept-art-.+\.webp)$/,
        `public/world 下出现未登记产物 ${entry}`,
      );
    }
  }
});
