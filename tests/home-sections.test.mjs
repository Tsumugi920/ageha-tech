/**
 * 首页三版块（精选项目 / 关于我 / 探索与成长）冒烟测试（node:test）：
 * 校验数据集中管理、诚实占位标注、无年份承诺、版块结构与双形态嵌套。
 * 运行方式：npm test（即 node --test "tests/*.test.mjs"）
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test("lib/projects.ts 集中管理三个项目，slug、标签与封面素材真实就位", () => {
  const data = readProjectFile("lib/projects.ts");

  // 三个 slug 齐全
  for (const slug of ["agehaos", "cs-skin-invest", "moss-world"]) {
    assert.ok(data.includes(`slug: "${slug}"`), `应有 slug ${slug}`);
  }

  // 封面路径指向 public/images/ 下真实存在的文件
  for (const cover of ["cover-agehaos.png", "cover-cs.png", "cover-moss.png"]) {
    assert.ok(
      existsSync(path.join(projectRoot, "public", "images", cover)),
      `缺少 public/images/${cover}`,
    );
    assert.ok(data.includes(`/images/${cover}`), `应引用 /images/${cover}`);
  }

  // 技术标签与参考一致
  for (const tag of [
    "TypeScript",
    "Next.js",
    "Tailwind CSS",
    "React",
    "Chart.js",
    "Python",
    "Three.js",
    "WebGL",
  ]) {
    assert.ok(data.includes(`"${tag}"`), `应包含标签 ${tag}`);
  }
});

test("项目数据不虚构上线状态、演示/源码链接与日期", () => {
  const data = readProjectFile("lib/projects.ts");

  for (const banned of [
    "已上线",
    "正式发布",
    "已发布",
    "demoUrl",
    "sourceUrl",
    "liveUrl",
    "http://",
    "https://",
  ]) {
    assert.ok(!data.includes(banned), `项目数据不应出现 ${banned}`);
  }

  // 三张封面全部明确标注「概念视觉占位」（诚实规则）
  assert.ok(
    (data.match(/概念视觉占位/g) || []).length >= 3,
    "每张封面的 alt 都应如实标注概念视觉占位",
  );
});

test("三个版块源文件与共享数据一律不出现年份或时间区间", () => {
  const files = [
    "components/home/FeaturedProjects.tsx",
    "components/projects/ProjectCard.tsx",
    "components/home/AboutSection.tsx",
    "components/home/JourneySection.tsx",
    "lib/projects.ts",
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
});

test("FeaturedProjects：玻璃大板 + 头部行 + 三等列网格复用共享 ProjectCard", () => {
  const src = readProjectFile("components/home/FeaturedProjects.tsx");

  assert.match(src, /id="projects"/, "应带 projects 锚点");
  assert.match(src, /Featured Projects/i, "应有 FEATURED PROJECTS eyebrow");
  assert.ok(src.includes("精选项目"), "应有版块标题");
  assert.ok(src.includes("View All"), "应有 View All 链接");
  assert.ok(src.includes("/projects"), "View All 应指向 /projects");
  assert.ok(
    src.includes("一些正在构建、持续打磨") &&
      src.includes("或记录我技术探索过程的作品"),
    "右上注记应保留「正在构建/打磨」的过程性定位",
  );
  assert.ok(
    src.includes('from "@/lib/projects"'),
    "项目数据应来自 lib/projects.ts",
  );
  // 卡片本体抽取为共享组件（首页与 /projects 列表页共用，视觉一致）
  assert.ok(
    src.includes('from "@/components/projects/ProjectCard"'),
    "应复用共享 ProjectCard 组件",
  );
  assert.ok(
    src.includes("<ProjectCard project={project} index={index + 1} />"),
    "卡片应通过 ProjectCard 渲染（首页不传 priority，封面懒加载）",
  );
  assert.match(src, /md:grid-cols-3/, "桌面应为三等列网格");
});

test("ProjectCard：首页与列表页共用的唯一卡片实现，诚实标注与 slug 链接就位", () => {
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
  assert.ok(src.includes("line-clamp-2"), "描述应为两行截断");
  assert.ok(
    src.includes("project.tags.map"),
    "应渲染技术标签",
  );
  // 诚实边界：卡片不渲染演示 / 源码链接等虚构字段
  assert.doesNotMatch(src, /demoUrl|sourceUrl|liveUrl|https?:\/\//);
});

test("AboutSection：通栏玻璃板四区结构、三句文案与概念插画标注就位", () => {
  const src = readProjectFile("components/home/AboutSection.tsx");

  assert.match(src, /id="about"/, "应带 about 锚点");
  assert.match(src, /About Me/i, "应有 ABOUT ME eyebrow");
  assert.ok(src.includes("关于我"), "应有版块标题");
  for (const sentence of [
    "我热爱技术，专注于构建有意义的数字产品。",
    "喜欢探索前沿技术，也享受设计和创造的过程。",
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
  assert.match(src, /lg:grid-cols-\[26fr_30fr_26fr_18fr\]/, "桌面应为四区横排");
});

test("JourneySection：三阶段时间线就位，桌面嵌套 About、移动端独立成块", () => {
  const src = readProjectFile("components/home/JourneySection.tsx");

  assert.match(src, /id="journey"/, "应带 journey 锚点");
  assert.match(src, /My Journey/i, "应有 MY JOURNEY 面板标题");
  assert.ok(src.includes("探索与成长"), "移动端应有「探索与成长」标题");
  for (const [title, desc] of [
    ["探索", "学习 Web 前端与产品构建"],
    ["进阶", "深入 React / Next.js 体系与工程化"],
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
