/**
 * 路由与导航契约测试（node:test）：
 * 校验六个内页就位与各自 metadata、项目详情页诚实边界（状态/入口来自数据、
 * 未上线项目无任何入口）、Navbar/Footer 完整实现与路由导航映射（首页 3D 化
 * 后全站统一路由链接）、以及全站图片一律 next/image（首屏 priority，
 * 其余懒加载）。世界 UI 组件同样受裸 <img> 扫描约束（§11.1 图片纪律）。
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
  assert.match(
    page,
    /md:grid-cols-2 md:gap-8 xl:grid-cols-3/,
    "网格应为 md 两列（1024 档防窄卡截断，间距 32px）+ xl 三等列",
  );
  assert.match(page, /全部项目/);
  assert.match(page, /返回首页/);
  // 过程性注记，不做成果宣言
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

test("项目详情页：状态徽标来自数据，仅渲染数据里真实存在的入口链接", () => {
  const page = readProjectFile("app/projects/[slug]/page.tsx");

  // 状态徽标渲染 project.status（已上线 / 可本地运行），无障碍文本就位
  assert.match(page, /\{project\.status\}/, "状态徽标应渲染数据里的 status");
  assert.ok(page.includes("项目状态：${project.status}"), "状态应有无障碍文本");
  assert.ok(
    !page.includes("正式发布") && !page.includes("已发布"),
    "详情页不应出现未经验证的发布状态词",
  );
  assert.ok(!page.includes("demoUrl") && !page.includes("sourceUrl") && !page.includes("liveUrl"),
    "详情页不应出现演示/源码类字段名");
  // 入口按钮渲染 project.links（在线体验 / 查看源码），文案来自数据
  assert.match(page, /\{link\.label\}/, "入口按钮文案应来自数据");
  assert.match(page, /\{link\.href\}/, "入口按钮链接应来自数据");
  assert.match(page, /target="_blank"/, "外链应新窗口打开");
  assert.match(page, /rel="noreferrer"/, "外链应带 noreferrer");
  // 诚实边界：页面源码不出现字面外链（链接全部来自 lib/projects.ts）
  assert.doesNotMatch(page, /https?:\/\//, "页面源码不应出现字面外部链接");
});

test("项目详情页：封面按 coverKind 如实标注 + 首屏 priority，类别/描述/标签/返回链接就位", () => {
  const page = readProjectFile("app/projects/[slug]/page.tsx");

  assert.match(page, /from "next\/image"/, "封面应使用 next/image");
  assert.match(page, /priority/, "详情页封面为首屏大图，应 priority");
  assert.match(
    page,
    /project\.coverKind === "concept"/,
    "封面徽标应按 coverKind 条件渲染（概念占位才挂徽标，真实界面截图不挂）",
  );
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

test("app/contact/page.tsx：复用暮光联系版块，未配置渠道按开关隐藏", () => {
  const page = readProjectFile("app/contact/page.tsx");

  assert.match(page, /title: "联系我"/);
  assert.match(page, /<ContactSection \/>/);
  // 未配置渠道已从联系区隐藏，页面文案如实说明「配置完成后自动出现」
  assert.match(page, /GitHub 已接入/);
  assert.ok(!page.includes("待配置"), "页面不应再以「待配置」当正式内容展示");
  // 诚实边界：不虚构任何邮箱或社交账号
  assert.doesNotMatch(
    page,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@ageha/,
  );
  assert.doesNotMatch(page, emojiPattern);
});

/* --------------------------------- 导航 --------------------------------- */

test("navigation.ts：导航项即内容路由（首页 3D 化后无页内锚点），标签仍单源 lib/site.ts", () => {
  const nav = readProjectFile("components/layout/navigation.ts");
  const siteConfig = readProjectFile("lib/site.ts");

  assert.match(nav, /from "@\/lib\/site"/, "导航数据应派生自 lib/site.ts");
  // navItems 一律路由链接（原 #home/#projects… 锚点随首页版块退役移除）
  for (const route of ["/", "/projects", "/about", "/tech", "/articles"]) {
    assert.ok(siteConfig.includes(`href: "${route}"`), `site.ts 应有路由 ${route}`);
  }
  assert.doesNotMatch(siteConfig, /href: "#/, "site.ts 不应再有 # 锚点导航项");
  assert.match(nav, /isNavLinkActive/, "应保留路由高亮判定");
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
  // 品牌链接：一律路由链接回首页（不再有 #home 锚点分支）
  assert.match(navbar, /href="\/"/);
  assert.doesNotMatch(navbar, /href="#home"/);
  // 联系我按钮 → /contact
  assert.match(navbar, /href="\/contact"/);
  // 蝴蝶 Logo 接口保持稳定（hero.test.mjs 契约）
  assert.match(navbar, /gradientId="navbar-butterfly"/);
  assert.doesNotMatch(navbar, emojiPattern);
});

test("SiteNavLinks：导航项渲染路由链接并高亮当前路由，页脚共用同一实现", () => {
  const links = readProjectFile("components/layout/SiteNavLinks.tsx");

  assert.match(links, /"use client"/);
  assert.match(links, /from "next\/link"/);
  assert.match(links, /isNavLinkActive/, "应做当前路由高亮判定");
  assert.match(links, /aria-current=/, "当前项应有 aria-current");
  assert.match(links, /FooterNavLinks/, "应导出页脚链接组");
  // 全部条目为 <Link> 路由链接（不再有页内锚点 <a href="#…"> 形态）
  assert.doesNotMatch(links, /<a\s/);
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

  // 首屏大图 priority：项目详情页封面；列表页 / 世界降级页卡片封面不 priority
  // （原 HeroScene/FeaturedProjects 首屏断言随组件退役移除；阶段 2 将补
  //   ProjectDetailPanel 封面 next/image 懒加载断言——蓝图 §14.1）
  const listPage = readProjectFile("app/projects/page.tsx");
  assert.ok(!listPage.includes("priority"), "列表页卡片封面应懒加载");
  const fallback = readProjectFile("components/world/ui/FallbackProjects.tsx");
  assert.ok(!fallback.includes("priority"), "世界降级页卡片封面应懒加载");
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
