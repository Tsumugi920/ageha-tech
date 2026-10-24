# Ageha.tech

独立数字创作者的数字花园 —— 个人作品集站点：项目作品、技术栈、写作札记与联系方式。

> **当前状态：正在建设中。** 项目、文章与联系方式均处于占位阶段（详见
> [素材与占位说明](#素材与占位说明)），本 README 只描述已实现的内容，不含任何未落地功能的预告链接。

## 视觉方向：明亮蝴蝶版

整站采用 **明亮主题 · 冰蓝天空玻璃拟态**：

- **主视觉**：几何切面风格的水晶蝴蝶 —— 四片翅膀取蓝紫渐变 + 半透明白色切面高光
  （`components/layout/ButterflyLogo.tsx`，与 `app/icon.svg` 站点图标同源同款）；
- **底色**：冰蓝天空渐变（`--color-sky #DDF3FF` → `--color-ice #F1F8FF`），
  叠加半透明白色玻璃面板与卡片（`globals.css` 中 `@theme` 设计令牌统一管理）；
- **品牌强调色**：蓝 `#269DFF` / 青 `#54E3FF` / 紫 `#9C83FF` / 粉 `#E3A1FF`；
- **可读性**：链接与焦点环使用逐底实测的加深档（`--color-link #1A64BE` 等），
  以 WCAG AA（正文 4.5:1、大字与焦点指示 3:1）为底线，由
  `tests/contrast.test.mjs` 数值级回归守护；
- **动效克制**：纯 CSS 关键帧 + IntersectionObserver 离屏暂停，
  `prefers-reduced-motion` 下全部动画静止。

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | [Next.js](https://nextjs.org) 16（App Router，全站静态 / SSG 预渲染） |
| UI | React 19 + Tailwind CSS v4（`@tailwindcss/postcss`，CSS-first `@theme` 令牌） |
| 图标 | lucide-react |
| 语言 | TypeScript（严格模式） |
| 测试 | Node.js 内置 `node:test`（无需额外测试框架） |
| 代码质量 | ESLint 10 + `eslint-config-next` |

## 快速开始

本机验证环境：Windows + Node.js v24.18.0（测试套件依赖 Node 24 的
原生 TypeScript 类型剥离直接 `import` `.ts` 数据模块，建议使用 Node 24+）。

```bash
# 1. 安装依赖
npm install

# 2. 本地开发（http://localhost:3000）
npm run dev

# 3. 生产构建（全站 12 个路由，静态 / SSG 预渲染）
npm run build

# 4. 生产模式启动（需先 npm run build）
npm run start

# 5. 代码检查
npm run lint

# 6. 测试套件（node --test，11 个测试文件 / 95 条断言用例）
npm test
```

以上命令均来自 `package.json` 的 `scripts` 字段，其中 `lint`、`test`、`build`
已在提交前于本机实际运行通过（0 告警 / 95 通过 0 失败 / 构建成功）。

## 目录结构

```
AgehaTech/
├── app/                        # Next.js App Router 路由
│   ├── page.tsx                # 首页：七个版块（Hero → 项目 → 关于 → 成长 → 技术栈 → 文章 → 联系）
│   ├── layout.tsx              # 根布局：Navbar / Footer / 键盘跳转链接
│   ├── globals.css             # @theme 设计令牌 + 玻璃拟态工具类 + hero 动效
│   ├── icon.svg                # 站点图标（蝴蝶 Logo）
│   ├── about/ · tech/ · articles/ · contact/   # 内容路由页（含各自 metadata）
│   └── projects/
│       ├── page.tsx            # 项目列表页
│       └── [slug]/page.tsx     # 项目详情页（generateStaticParams SSG ×3）
├── components/
│   ├── home/                   # 七个首页版块 + HeroScene 主视觉场景
│   ├── layout/                 # Navbar / Footer / ButterflyLogo / PageHeader / 导航数据模型
│   ├── projects/ProjectCard.tsx
│   └── ui/                     # GlassCard / GlassPanel / GlassButton / Badge / SectionHeading
├── lib/                        # 集中管理的数据与配置（站点配置 / 项目 / 文章计划 / 技术栈）
├── tests/                      # node:test 契约测试（结构 / 路由 / 设计系统 / 对比度 / 诚实边界…）
├── public/images/              # 参考图裁切的概念占位素材（见下表）
├── Ageha.tech未来数字世界作品集.png   # 设计参考原图（仓库根目录）
├── _assets/                    # 参考图裁切素材源（仅本地，不入库）
└── Discarded proposal/         # 废案文件夹（仅本地，不入库）
```

## 素材与占位说明

**所有站点图片均为设计参考图（根目录 `Ageha.tech未来数字世界作品集.png`）
的裁切产物，是概念视觉占位，不是真实产品界面或个人照片。**
裁切源文件存放在本地 `_assets/`（已被 `.gitignore` 排除），
`public/images/` 中入库的六张如下：

| 文件 | 用途 | 引用位置 | 占位性质 |
| --- | --- | --- | --- |
| `hero-clean.png` | Hero 主视觉场景插画（水晶蝴蝶 + 悬浮尖塔城市 + 光环） | `components/home/HeroScene.tsx` | 参考图裁切的概念视觉 |
| `hero-full.png` | 完整版场景图（备用素材） | 暂未被代码引用（测试仅校验其存在） | 参考图裁切的概念视觉 |
| `about-photo.png` | 「关于我」版块照片位 | `components/home/AboutSection.tsx` | 参考图裁切，**非真实个人照片** |
| `cover-agehaos.png` | 项目 AgehaOS 封面 | `lib/projects.ts` → 项目卡片 / 详情页 | 概念占位，**非真实运行界面** |
| `cover-cs.png` | 项目 CS 饰品虚拟投资模拟器封面 | 同上 | 概念占位，**非真实运行界面** |
| `cover-moss.png` | 项目 Moss World 封面 | 同上 | 概念占位，**非真实运行界面** |

### 内容占位（诚实边界）

以下内容由 `tests/content-honesty.test.mjs` 数值级守护，接入真实信息前一律保持占位：

- **联系方式**（`lib/site.ts`）：GitHub / Email / X / Bilibili 四项均为「待配置」，
  页面上无任何虚构的外链；
- **项目**（`lib/projects.ts`）：三个项目均为探索中的作品，无上线状态、
  无演示 / 源码链接、无日期，封面 alt 文本如实标注「非真实运行界面」；
- **文章**（`lib/notes.ts`）：三条均为「写作计划中」的占位条目，
  无日期、无阅读量、无链接；
- **探索时间线**（首页 JourneySection）：不含任何年份。

## 部署提示（.tech 域名）

站点当前为纯静态 / SSG 输出（`npm run build` 已验证全路由预渲染），
常见两条路径：

1. **Vercel（Next.js 官方托管，最省事）**
   - 将仓库推到 GitHub 后在 Vercel 导入，构建命令 `npm run build` 即默认值；
   - 在域名注册商处购买 `ageha.tech`（或你的目标域名），按 Vercel 控制台提示
     添加 DNS 记录（根域 A 记录 `76.76.21.21` 或 CNAME `cname.vercel-dns.com`，
     以控制台当前提示为准），等待解析生效即可 HTTPS 访问；
   - 也可以先把 Vercel 分配的临时域名绑定的站点跑通，再切域名。
2. **自托管 Node 服务器**
   - `npm run build && npm run start`（默认 3000 端口），用 Nginx / Caddy
     反向代理并签发证书，域名 A 记录指向服务器 IP。

> 域名购买、DNS 解析与证书均需账号操作，本仓库不包含任何部署配置文件；
> 若后续接入 CI 自动部署，再补充对应说明。

## 测试套件

`npm test` 运行 `tests/*.test.mjs`（Node 内置 test runner），覆盖：

| 文件 | 守护内容 |
| --- | --- |
| `structure.test.mjs` | 首页七版块就位并被 `app/page.tsx` 渲染、SSG 参数、导航单源 |
| `routes.test.mjs` | 六个内页 metadata、诚实边界、图片一律 `next/image` |
| `design-system.test.mjs` | `@theme` 设计令牌与玻璃拟态类的存在与消费 |
| `contrast.test.mjs` | WCAG 对比度数值级回归（真实叠层 alpha 合成计算） |
| `responsive-perf.test.mjs` | 断点 / 触控面积 / 焦点环 / 图片加载策略 / reduced-motion |
| `hero.test.mjs` | 首屏文案、场景实现要点、Logo 接口、无 emoji |
| `home-sections.test.mjs` / `sections.test.mjs` | 版块数据单源、占位标注、无年份承诺 |
| `content-honesty.test.mjs` | 数据级诚实边界：无外链 / 无日期 / 全部「待配置」 |
| `site.test.mjs` | 站点配置、`.gitignore` 必含项、六张素材非空 |
| `readme.test.mjs` | README 与仓库真实状态一致（命令 / 素材表 / 占位说明） |
