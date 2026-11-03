/**
 * 结构契约测试（node:test）：
 * 校验首页 3D 世界入口（page.tsx → WorldShell、SSR 安全动态加载、
 * lib/world 数据层、#world-root 沉浸锚点、组件退役与保留边界）、
 * 项目详情页 generateStaticParams、Navbar 导航项数据单源与双形态渲染。
 * 断言基于文件存在性检查、源码正则与 lib/*.ts 数据级解析。
 * 运行方式：npm test（即 node --test "tests/*.test.mjs"）
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { projects } from "../lib/projects.ts";
import { site } from "../lib/site.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

/* ------------------------- 首页 3D 世界入口 ------------------------- */

test("首页渲染 WorldShell：SSR 壳 + ssr:false 动态加载 Canvas + #world-root 锚点", () => {
  const page = readProjectFile("app/page.tsx");
  assert.match(
    page,
    /import \{ WorldShell \} from "@\/components\/world\/WorldShell"/,
    "app/page.tsx 应导入 WorldShell",
  );
  assert.ok(page.includes("<WorldShell />"), "app/page.tsx 应渲染 <WorldShell />");
  // 首页不再消费任何 home 版块组件（世界即首页）
  assert.doesNotMatch(page, /from "@\/components\/home\//);

  const shell = readProjectFile("components/world/WorldShell.tsx");
  assert.match(shell, /"use client"/, "WorldShell 应为客户端组件");
  assert.match(
    shell,
    /dynamic\(\(\) => import\("\.\/WorldCanvas"\),\s*\{\s*ssr: false/s,
    "3D Canvas 必须 ssr:false 动态加载（Next 16 SSR 安全）",
  );
  assert.ok(
    shell.includes('id="world-root"'),
    "WorldShell 根节点应带 id=world-root（沉浸 CSS 契约锚点）",
  );
  // 首页唯一 h1 常驻 SSR（加载屏品牌大字 → 就绪收缩为角标，§13.1）
  const brand = readProjectFile("components/world/loading/LoadingScreen.tsx");
  assert.match(brand, /<h1 className="world-brand__title">Momori<\/h1>/);
  assert.match(brand, /助手 Momori 的个人站和作品集/);
});

test("lib/world 四模块存在且为纯 TS 数据层（node 可 import）", async () => {
  for (const name of ["constants", "layout", "colliders", "performance", "index"]) {
    const file = path.join(projectRoot, "lib", "world", `${name}.ts`);
    assert.ok(existsSync(file), `缺少 lib/world/${name}.ts`);
    assert.ok(statSync(file).size > 0, `lib/world/${name}.ts 不应为空文件`);
  }
  // 数据级导入（Node 24 原生类型剥离）——不应引入 three / JSX
  const world = await import("../lib/world/index.ts");
  assert.ok(world.TRAILS.length === 3, "应有三条蝶径");
  assert.ok(world.PROJECT_ISLES.length === 3, "应有三座项目屿");
  for (const name of ["constants", "layout", "colliders", "performance"]) {
    const source = readProjectFile(`lib/world/${name}.ts`);
    assert.ok(!source.includes('from "three"'), `lib/world/${name}.ts 不应依赖 three`);
    assert.ok(!source.includes("import React"), `lib/world/${name}.ts 不应依赖 React（纯数据层）`);
  }
});

test("组件退役边界：四个首页组件已退役，保留组件仍被内页消费", () => {
  // §14.0 退役清单：仅首页消费的版块随 3D 化删除
  for (const name of ["Hero", "HeroScene", "FeaturedProjects", "LatestNotes"]) {
    assert.ok(
      !existsSync(path.join(projectRoot, "components", "home", `${name}.tsx`)),
      `components/home/${name}.tsx 应已退役（蓝图 §14.0）`,
    );
  }
  // §14.0 保留清单：内页路由仍在消费
  const preserved = [
    ["AboutSection.tsx", "app/about/page.tsx"],
    ["JourneySection.tsx", "app/about/page.tsx"],
    ["TechStackSection.tsx", "app/tech/page.tsx"],
    ["ContactSection.tsx", "app/contact/page.tsx"],
    ["ProjectCard.tsx", "app/projects/page.tsx"],
  ];
  for (const [component, consumer] of preserved) {
    assert.ok(
      existsSync(path.join(projectRoot, "components", "home", component)) ||
        existsSync(path.join(projectRoot, "components", "projects", component)),
      `${component} 应保留`,
    );
    assert.ok(
      readProjectFile(consumer).includes(component.replace(".tsx", "")),
      `${consumer} 应仍消费 ${component}`,
    );
  }
});

/* ---------------------------- 项目详情路由 ---------------------------- */

test("app/projects/[slug]/page.tsx：generateStaticParams 映射全部项目 slug", () => {
  const page = readProjectFile("app/projects/[slug]/page.tsx");

  assert.match(page, /export function generateStaticParams\(\)/, "应导出 generateStaticParams");
  assert.match(
    page,
    /projects\.map\(\(project\) => \(\{ slug: project\.slug \}\)\)/,
    "应为每个项目生成 { slug } 静态参数",
  );
  assert.match(
    page,
    /import \{ projects \} from "@\/lib\/projects"/,
    "静态参数数据应单源 lib/projects.ts",
  );

  // 数据级：slug 互不重复，静态参数无歧义
  const slugs = projects.map((project) => project.slug);
  assert.ok(slugs.length > 0, "项目数据不应为空");
  assert.equal(new Set(slugs).size, slugs.length, "项目 slug 应互不重复");
  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9-]+$/, `slug "${slug}" 应为合法路由段`);
  }
});

/* ------------------------------- 导航结构 ------------------------------- */

test("Navbar 五个导航项：数据单源 lib/site.ts，标签与路由链接齐备且不重复", () => {
  assert.equal(site.navItems.length, 5, "导航应恰好 5 项");
  assert.deepEqual(
    site.navItems.map((item) => item.label),
    ["首页", "项目", "关于", "技术栈", "文章"],
    "五个导航标签应与站点信息一致",
  );

  // 首页 3D 化后无页内锚点：导航项一律为内容路由链接（锚点失效的处置）
  const expectedRoutes = ["/", "/projects", "/about", "/tech", "/articles"];
  assert.deepEqual(
    site.navItems.map((item) => item.href),
    expectedRoutes,
    "导航项应为五个内容路由链接（不再有 # 锚点）",
  );
  assert.equal(new Set(site.navItems.map((item) => item.href)).size, 5, "导航路由不应重复");
});

test("Navbar 五个导航项：路由链接数据单源，桌面/移动双形态渲染同一份数据", () => {
  const navigation = readProjectFile("components/layout/navigation.ts");
  const navbar = readProjectFile("components/layout/Navbar.tsx");
  const siteNavLinks = readProjectFile("components/layout/SiteNavLinks.tsx");

  // NAV_LINKS 派生自 lib/site.ts 的 navItems，不为每个路由另立数据
  assert.match(
    navigation,
    /site\.navItems/,
    "NAV_LINKS 应派生自 lib/site.ts 的 navItems",
  );

  // Navbar 以桌面 bar + 移动 sheet 两种形态渲染同一份导航数据
  assert.match(navbar, /<NavLinks layout="bar"/, "桌面导航应复用共享 NavLinks");
  assert.match(navbar, /<NavLinks layout="sheet"/, "移动菜单应复用共享 NavLinks");
  assert.match(siteNavLinks, /NAV_LINKS\.map/, "SiteNavLinks 应遍历 NAV_LINKS 渲染全部导航项");
  assert.match(siteNavLinks, /isNavLinkActive/, "应做当前路由高亮判定");
  assert.match(siteNavLinks, /aria-current=/, "当前项应有 aria-current");
});
