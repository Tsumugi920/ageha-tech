/**
 * 路由与导航契约测试（node:test）：
 * 校验六个内页就位与各自 metadata、项目详情页诚实边界（只写「探索中」、
 * 无虚构演示/源码入口）、Navbar/Footer 完整实现与锚点↔路由映射、
 * 以及全站图片一律 next/image（首屏 priority，其余懒加载）。
 * 运行方式：npm test（即 node --test "tests/*.test.mjs"）
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

/* ------------------------------ 项目列表页 ------------------------------ */

test("app/projects/page.tsx：全部项目网格复用 ProjectCard，metadata 与诚实注记就位", () => {
  const page = readProjectFile("app/projects/page.tsx");

  assert.match(page, /export const metadata: Metadata/, "应有页面 metadata");
  assert.match(page, /title: "项目"/);
  assert.match(page, /from "@\/lib\/projects"/, "数据应来自 lib/projects.ts");
  assert.match(page, /from "@\/components\/projects\/ProjectCard"/);
  assert.match(
    page,
    /<ProjectCard project=\{project\} index=\{index \+ 1\} headingLevel="h2" \/>/,
    "应复用共享卡片（列表页 h1 下无中间层级，标题升 h2 避免跳级）",
  );
  assert.match(page, /md:grid-cols-3/, "桌面应为三等列网格");
  assert.match(page, /全部项目/);
  assert.match(page, /返回首页/);
  // 过程性注记与首页同源，不做成果宣言
  assert.ok(page.includes("一些正在构建、持续打磨"));
  assert.doesNotMatch(page, emojiPattern);
});

/* ------------------------------ 项目详情页 ------------------------------ */

test("app/projects/[slug]/page.tsx：generateStaticParams 覆盖三个项目，非法 slug notFound", () => {
  const page = readProjectFile("app/projects/[slug]/page.tsx");
  const data = readProjectFile("lib/projects.ts");

  assert.match(page, /export function generateStaticParams/, "应有 generateStaticParams");
  assert.match(page, /projects\.map\(\(project\) => \(\{ slug: project\.slug \}\)\)/, "应映射全部项目 slug");
  for (const slug of ["agehaos", "cs-skin-invest", "moss-world"]) {
    assert.ok(data.includes(`slug: "${slug}"`), `lib 数据应有 ${slug}`);
  }
  assert.match(page, /notFound\(\)/, "非法 slug 应 notFound()");
  assert.match(page, /params: Promise<\{ slug: string \}>/, "Next.js 16 params 为 Promise");
});

test("项目详情页：状态徽标只写「探索中」，绝无上线/发布等虚构状态与演示/源码入口", () => {
  const page = readProjectFile("app/projects/[slug]/page.tsx");

  assert.match(page, /STATUS_LABEL = "探索中"/);
  assert.ok(page.includes("项目状态：${STATUS_LABEL}"), "状态应有无障碍文本");
  // 诚实边界：全页不出现虚构状态词或演示/源码入口（字段、按钮、外链均无）
  for (const banned of ["已上线", "正式发布", "已发布", "demoUrl", "sourceUrl", "liveUrl", "查看演示", "查看源码", "访问演示", "访问源码"]) {
    assert.ok(!page.includes(banned), `详情页不应出现 ${banned}`);
  }
  assert.doesNotMatch(page, /https?:\/\//, "不应出现任何外部链接");
});

test("项目详情页：封面（概念视觉占位 + 首屏 priority）、类别/描述/标签/返回链接就位", () => {
  const page = readProjectFile("app/projects/[slug]/page.tsx");

  assert.match(page, /from "next\/image"/, "封面应使用 next/image");
  assert.match(page, /priority/, "详情页封面为首屏大图，应 priority");
  assert.match(page, /概念视觉占位/, "封面应保留概念视觉占位标注");
  assert.match(page, /alt=\{project\.coverAlt\}/, "alt 应如实引用 coverAlt");
  assert.match(page, /\{project\.category\}/, "应渲染类别");
  assert.match(page, /\{project\.description\}/, "应渲染描述");
  assert.match(page, /\{project\.tags\.map/, "应渲染技术标签");
  assert.match(page, /返回项目列表/, "应有返回列表链接");
  assert.match(page, /href: "\/projects"/, "返回链接应指向 /projects");
  assert.match(page, /generateMetadata/, "应有每项目 metadata");
  // 渲染仅限 Project 类型真实存在的字段（slug 链接在 ProjectCard 内），无额外虚构入口
  assert.match(page, /\{project\.name\}/, "应渲染项目名");
  assert.doesNotMatch(page, emojiPattern);
});

/* -------------------------- 关于 / 技术栈 / 文章 / 联系 -------------------------- */

test("app/about/page.tsx：复用关于我 + 探索成长版块，metadata 就位", () => {
  const page = readProjectFile("app/about/page.tsx");

  assert.match(page, /title: "关于我"/);
  assert.match(page, /<AboutSection \/>/);
  assert.match(page, /<JourneySection \/>/);
  assert.match(page, /<PageHeader/);
  assert.doesNotMatch(page, emojiPattern);
});

test("app/tech/page.tsx：复用技术栈版块，说明保持「不附带熟练度」口径", () => {
  const page = readProjectFile("app/tech/page.tsx");

  assert.match(page, /title: "技术栈"/);
  assert.match(page, /<TechStackSection \/>/);
  assert.match(page, /在用 \/ 在学/);
  assert.match(page, /不附带任何熟练度、年限或认证声明/);
  assert.doesNotMatch(page, /精通|资深|Expert|Master/);
  assert.doesNotMatch(page, emojiPattern);
});

test("app/articles/page.tsx：空状态 + 写作计划条目，无日期/阅读量/虚构链接", () => {
  const page = readProjectFile("app/articles/page.tsx");

  assert.match(page, /title: "文章与实验"/);
  assert.match(page, /from "@\/lib\/notes"/);
  assert.match(page, /当前还没有已发布文章/, "应有空状态说明");
  assert.match(page, /\{plannedNotes\.map/, "应渲染写作计划条目");
  assert.match(page, /\{plannedNoteLabel\}/, "每条应带「写作计划中」标注");
  assert.match(page, /概念视觉/, "缩略图应如实标注概念视觉");
  // 诚实边界：无日期、无阅读量数值、条目不可点击（无 <a> 包裹）
  assert.doesNotMatch(page, /20\d{2}-\d{2}|"date"|"views"|"readCount"/);
  assert.doesNotMatch(page, /阅读量[:：]?\s*\d/);
  assert.doesNotMatch(page, emojiPattern);
});

test("app/contact/page.tsx：复用夜景联系版块，渠道保持「待配置」口径", () => {
  const page = readProjectFile("app/contact/page.tsx");

  assert.match(page, /title: "联系我"/);
  assert.match(page, /<ContactSection \/>/);
  assert.match(page, /待配置/);
  // 诚实边界：不虚构任何邮箱或社交账号
  assert.doesNotMatch(
    page,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@ageha/,
  );
  assert.doesNotMatch(page, emojiPattern);
});

/* --------------------------------- 导航 --------------------------------- */

test("navigation.ts：锚点 ↔ 内容路由一一对应，标签仍单源 lib/site.ts", () => {
  const nav = readProjectFile("components/layout/navigation.ts");
  const siteConfig = readProjectFile("lib/site.ts");

  assert.match(nav, /from "@\/lib\/site"/, "导航数据应派生自 lib/site.ts");
  assert.match(nav, /"#home": "\/"/);
  assert.match(nav, /"#projects": "\/projects"/);
  assert.match(nav, /"#about": "\/about"/);
  assert.match(nav, /"#tech": "\/tech"/);
  assert.match(nav, /"#notes": "\/articles"/);
  // lib/site.ts 的五个导航标签保持不变（Navbar 与 Footer 共用）
  for (const label of ["首页", "项目", "关于", "技术栈", "文章"]) {
    assert.ok(siteConfig.includes(`label: "${label}"`), `site.ts 应有 ${label}`);
  }
});

test("Navbar 完整实现：路由高亮、滚动透明度变化、移动端菜单、联系我 → /contact", () => {
  const navbar = readProjectFile("components/layout/Navbar.tsx");

  assert.match(navbar, /"use client"/);
  assert.match(navbar, /usePathname/, "应基于当前路由渲染");
  assert.match(navbar, /window\.addEventListener\("scroll"/, "应监听滚动");
  assert.match(navbar, /bg-white\/70/, "滚动后背景透明度应轻微变化");
  // 移动端汉堡菜单：可展开 / 关闭，触控面积足够，关闭态不可聚焦
  assert.match(navbar, /aria-expanded=\{menuOpen\}/);
  assert.match(navbar, /aria-controls="mobile-nav-menu"/);
  assert.match(navbar, /size-11/, "汉堡按钮触控面积应 ≥44px");
  assert.match(navbar, /inert=\{!menuOpen\}/);
  assert.match(navbar, /Escape/, "Esc 应能关闭菜单");
  assert.match(navbar, /<NavLinks layout="bar"/, "桌面导航条目应复用共享实现");
  assert.match(navbar, /<NavLinks layout="sheet"/, "移动菜单条目应复用共享实现");
  // 联系我按钮 → /contact
  assert.match(navbar, /href="\/contact"/);
  // 蝴蝶 Logo 接口保持稳定（hero.test.mjs 契约）
  assert.match(navbar, /gradientId="navbar-butterfly"/);
  assert.doesNotMatch(navbar, emojiPattern);
});

test("SiteNavLinks：首页渲染页内锚点，其他页渲染路由链接并高亮", () => {
  const links = readProjectFile("components/layout/SiteNavLinks.tsx");

  assert.match(links, /"use client"/);
  assert.match(links, /from "next\/link"/);
  assert.match(links, /resolveNavLinkHref/);
  assert.match(links, /isNavLinkActive/, "应做当前路由高亮判定");
  assert.match(links, /aria-current=/, "当前项应有 aria-current");
  assert.match(links, /FooterNavLinks/, "应导出页脚链接组");
  assert.doesNotMatch(links, emojiPattern);
});

test("Footer 链接与导航对齐：共用 FooterNavLinks 与蝴蝶 Logo 契约", () => {
  const footer = readProjectFile("components/layout/Footer.tsx");

  assert.match(footer, /<FooterNavLinks \/>/, "页脚应复用与导航条同一份链接实现");
  assert.ok(!footer.includes("site.navItems.map"), "不应再单独遍历 navItems（避免两套入口漂移）");
  assert.match(footer, /gradientId="footer-butterfly"/);
  assert.doesNotMatch(footer, emojiPattern);
});

/* ------------------------------ 全站图片纪律 ------------------------------ */

test("全站图片一律 next/image：无裸 <img>，首屏 priority，其余懒加载", () => {
  const scanDir = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (entry.name.endsWith(".tsx")) {
        const src = readProjectFile(path.relative(projectRoot, full).replaceAll("\\", "/"));
        assert.ok(!/<img[\s>]/.test(src), `${full} 不应出现裸 <img>`);
        if (/<Image[\s>]/.test(src)) {
          assert.ok(src.includes('from "next/image"'), `${full} 应从 next/image 引入 Image`);
        }
      }
    }
  };
  scanDir(path.join(projectRoot, "app"));
  scanDir(path.join(projectRoot, "components"));

  // 首屏大图 priority：Hero 场景与项目详情页封面；首页/列表页卡片封面不 priority
  const scene = readProjectFile("components/home/HeroScene.tsx");
  assert.match(scene, /priority/);
  const featured = readProjectFile("components/home/FeaturedProjects.tsx");
  assert.ok(!featured.includes("priority"), "首页卡片封面应懒加载");
  const listPage = readProjectFile("app/projects/page.tsx");
  assert.ok(!listPage.includes("priority"), "列表页卡片封面应懒加载");
  const detail = readProjectFile("app/projects/[slug]/page.tsx");
  assert.match(detail, /priority/, "详情页封面为首屏大图，应 priority");
});

/* ------------------------------ 内页公共页头 ------------------------------ */

test("PageHeader：内页统一页头（返回链接 + Badge + h1 + 描述）", () => {
  const header = readProjectFile("components/layout/PageHeader.tsx");

  assert.match(header, /<h1/, "内页应有 h1 主标题");
  assert.match(header, /<Badge>\{eyebrow\}/);
  assert.match(header, /from "next\/link"/, "返回链接应使用 next/link");
  for (const page of [
    "app/projects/page.tsx",
    "app/about/page.tsx",
    "app/tech/page.tsx",
    "app/articles/page.tsx",
    "app/contact/page.tsx",
  ]) {
    assert.ok(
      readProjectFile(page).includes("<PageHeader"),
      `${page} 应使用统一页头`,
    );
  }
  assert.doesNotMatch(header, emojiPattern);
});
