/**
 * 结构契约测试（node:test）：
 * 校验七个首页版块组件存在且被 app/page.tsx 引用、
 * 项目详情页提供 generateStaticParams、
 * Navbar 的五个导航项数据单源且双形态渲染。
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

/* app/page.tsx 依序渲染的七个首页版块 */
const HOME_SECTIONS = [
  "Hero",
  "FeaturedProjects",
  "AboutSection",
  "JourneySection",
  "TechStackSection",
  "LatestNotes",
  "ContactSection",
];

/* ------------------------------ 首页版块 ------------------------------ */

test("七个首页版块组件文件存在且被 app/page.tsx 导入并渲染", () => {
  const page = readProjectFile("app/page.tsx");

  for (const name of HOME_SECTIONS) {
    const sectionFile = path.join(projectRoot, "components", "home", `${name}.tsx`);
    assert.ok(existsSync(sectionFile), `缺少版块组件 components/home/${name}.tsx`);
    assert.ok(
      statSync(sectionFile).size > 0,
      `components/home/${name}.tsx 不应为空文件`,
    );
    assert.match(
      page,
      new RegExp(`import \\{ ${name} \\} from "@/components/home/${name}"`),
      `app/page.tsx 应导入 ${name}`,
    );
    assert.ok(page.includes(`<${name}`), `app/page.tsx 应渲染 <${name}>`);
  }

  // 除这七个版块外，page.tsx 不应再引入其他 home 组件（防止游离版块）
  const homeImports = page.match(/from "@\/components\/home\//g) ?? [];
  assert.equal(
    homeImports.length,
    HOME_SECTIONS.length,
    `app/page.tsx 的 home 版块导入应恰好 ${HOME_SECTIONS.length} 个`,
  );
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

test("Navbar 五个导航项：数据单源 lib/site.ts，标签与锚点齐备且不重复", () => {
  assert.equal(site.navItems.length, 5, "导航应恰好 5 项");
  assert.deepEqual(
    site.navItems.map((item) => item.label),
    ["首页", "项目", "关于", "技术栈", "文章"],
    "五个导航标签应与站点信息一致",
  );

  const hrefs = site.navItems.map((item) => item.href);
  assert.equal(new Set(hrefs).size, 5, "导航锚点不应重复");
  for (const href of hrefs) {
    assert.match(href, /^#[\w-]+$/, `导航项 ${href} 应为首页页内锚点`);
  }
});

test("Navbar 五个导航项：锚点↔路由映射齐全，桌面/移动双形态渲染同一份数据", () => {
  const navigation = readProjectFile("components/layout/navigation.ts");
  const navbar = readProjectFile("components/layout/Navbar.tsx");
  const siteNavLinks = readProjectFile("components/layout/SiteNavLinks.tsx");

  // NAV_LINKS 派生自 lib/site.ts 的 navItems，不为每个锚点另立数据
  assert.match(
    navigation,
    /site\.navItems\.map/,
    "NAV_LINKS 应派生自 lib/site.ts 的 navItems",
  );
  for (const { href } of site.navItems) {
    assert.ok(
      navigation.includes(`"${href}"`),
      `navigation.ts 应为锚点 ${href} 提供对应内容路由映射`,
    );
  }

  // Navbar 以桌面 bar + 移动 sheet 两种形态渲染同一份导航数据，
  // 条目数由 NAV_LINKS.map 展开保证（五项数据 → 五个 <li>）
  assert.match(navbar, /<NavLinks layout="bar"/, "桌面导航应复用共享 NavLinks");
  assert.match(navbar, /<NavLinks layout="sheet"/, "移动菜单应复用共享 NavLinks");
  assert.match(siteNavLinks, /NAV_LINKS\.map/, "SiteNavLinks 应遍历 NAV_LINKS 渲染全部导航项");
});
