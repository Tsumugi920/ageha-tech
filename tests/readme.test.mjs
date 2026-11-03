/**
 * README 契约测试（node:test）：
 * 守护 README 与仓库真实状态一致 —— 运行命令与 package.json scripts 逐字对应、
 * 三张 public/images 素材全部在素材表中如实登记、诚实占位说明在位。
 * 防止 README 漂移成「愿景文档」。运行方式：npm test
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

test("README.md 存在且非空", () => {
  const readmePath = path.join(projectRoot, "README.md");
  assert.ok(existsSync(readmePath), "README.md 应存在于仓库根目录");
  assert.ok(statSync(readmePath).size > 100, "README.md 不应是空壳");
});

test("README 快速开始命令与 package.json scripts 逐字对应", () => {
  const readme = readProjectFile("README.md");
  const pkg = JSON.parse(readProjectFile("package.json"));

  for (const script of ["dev", "build", "start", "lint", "test"]) {
    assert.ok(
      pkg.scripts[script],
      `package.json 应有 scripts.${script}`,
    );
    assert.match(
      readme,
      new RegExp(`npm run ${script}|npm test`),
      `README 应提及 npm run ${script}（npm test 除外）`,
    );
  }
  assert.match(readme, /npm install/, "README 应包含依赖安装步骤");
});

test("README 素材表登记 public/images 全部三张图，且引用的文件真实存在", () => {
  const readme = readProjectFile("README.md");
  const images = readdirSync(path.join(projectRoot, "public", "images"));

  assert.equal(images.length, 3, "public/images 应恰好有三张登记素材");
  for (const image of images) {
    assert.ok(
      existsSync(path.join(projectRoot, "public", "images", image)),
      `public/images/${image} 应真实存在`,
    );
    assert.match(
      readme,
      new RegExp(image.replace(".", "\\.")),
      `README 素材表应登记 ${image}`,
    );
  }
});

test("README 保留诚实说明：真实素材如实标注，占位内容不伪装成真实成果", () => {
  const readme = readProjectFile("README.md");

  assert.match(readme, /占位/, "README 应说明仍处于占位的内容");
  assert.match(readme, /待配置/, "README 应说明部分联系方式待配置");
  assert.match(readme, /写作计划中/, "README 应说明文章为写作计划占位");
  assert.match(readme, /真实界面截图/, "README 应如实声明项目封面为真实界面截图");
  assert.match(readme, /非真实个人照片/, "README 应声明关于照片位非真实照片");
  assert.match(readme, /正在建设中/, "README 应如实标注站点建设状态");
});
