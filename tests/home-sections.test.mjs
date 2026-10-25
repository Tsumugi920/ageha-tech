/**
 * 项目数据与版块消费冒烟测试（node:test）：
 * 校验项目数据集中管理与诚实边界、共享卡片实现、保留版块（/about 等）
 * 与共享数据不出现年份。首页消费侧契约已迁移：三项目的场景内数据渲染
 * 由 world-layout.test.mjs 守护；HTML 面板（ProjectDetailPanel /
 * WorldNavPanel 渲染 lib/projects.ts 同源数据）的断言在阶段 2 落地。
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

test("lib/projects.ts 集中管理三个项目，slug、标签与真实封面素材就位", () => {
  const data = readProjectFile("lib/projects.ts");

  // 三个 slug 齐全
  for (const slug of ["agehaos", "cs-skin-invest", "moss-world"]) {
    assert.ok(data.includes(`slug: "${slug}"`), `应有 slug ${slug}`);
  }

  // 封面路径指向 public/images/ 下真实存在的文件
  for (const cover of [
    "agehaos-desktop.jpg",
    "cs-market-portfolio.png",
    "moss-world-terrarium.png",
  ]) {
    assert.ok(
      existsSync(path.join(projectRoot, "public", "images", cover)),
      `缺少 public/images/${cover}`,
    );
    assert.ok(data.includes(`/images/${cover}`), `应引用 /images/${cover}`);
  }

  // 技术标签来自各项目仓库的实际依赖
  for (const tag of [
    "React 19",
    "TypeScript",
    "Vite",
    "Zustand",
    "Tailwind CSS 4",
    "Next.js 15",
    "FastAPI",
    "ECharts",
    "SQLAlchemy",
    "Three.js",
    "React Three Fiber",
  ]) {
    assert.ok(data.includes(`"${tag}"`), `应包含标签 ${tag}`);
  }
});

test("项目状态与入口链接如实：已上线才给链接，封面一律真实界面截图", () => {
  const data = readProjectFile("lib/projects.ts");

  // 只允许两种有据可查的状态词；未上线的表述仍禁止
  for (const banned of ["正式发布", "已发布", "demoUrl", "sourceUrl", "liveUrl"]) {
    assert.ok(!data.includes(banned), `项目数据不应出现 ${banned}`);
  }
  assert.ok(data.includes('status: "已上线"'), "AgehaOS/CS 已上线（站长 README 载明）");
  assert.ok(
    data.includes('status: "可本地运行"'),
    "Moss World 无上线记录，应为可本地运行",
  );

  // 三张封面全部为真实界面截图，不再使用概念占位
  assert.equal((data.match(/coverKind: "real"/g) ?? []).length, 3, "三张封面应均为真实界面截图");
  assert.ok(
    !data.includes("概念视觉占位"),
    "项目封面已是真实截图，不应再出现概念占位标注",
  );

  // 真实入口链接（域名白名单）只属于已上线项目
  const linkHosts = [...data.matchAll(/href: "(https?:\/\/[^"]+)"/g)].map(
    (match) => match[1],
  );
  for (const href of linkHosts) {
    assert.match(
      href,
      /^https:\/\/(os\.ageha\.cn|cs\.ageha\.cn|github\.com\/Ageha6912)(\/|$)/,
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
  assert.match(src, /lg:grid-cols-\[0\.9fr_1\.2fr_1fr\]/, "桌面应为三栏横排（文字 / 视觉图 / 方向+时间线）");
  assert.ok(!src.includes("GlassPanel"), "关于我不应再把整段包进巨型玻璃板");
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
