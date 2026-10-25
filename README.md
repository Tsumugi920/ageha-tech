# Ageha.tech

独立数字创作者的数字花园 —— 个人作品集站点：项目作品、技术栈、写作札记与联系方式。

> **当前状态：正在建设中。** 三个精选项目已接入真实信息 —— AgehaOS 与
> CS 饰品虚拟投资模拟器已上线，Moss World 可本地运行（详见
> [收录的项目](#收录的项目)）；文章仍为写作计划，「关于我」照片与部分
> 联系方式仍为占位（详见 [素材与占位说明](#素材与占位说明)）。

## 收录的项目

三个项目均来自站长的本地仓库，状态与入口链接以各项目仓库 README 为准
（`lib/projects.ts` 单源管理，站点上的状态徽标与入口按钮只渲染其中有据可查的内容）：

| 项目 | 简介 | 状态 | 入口 |
| --- | --- | --- | --- |
| AgehaOS | 浏览器里的操作系统式 Web OS：窗口管理器、虚拟文件系统、App Store 沙箱运行时 + AI 动态桌面与羽化生成应用 | 已上线 | [os.ageha.cn](https://os.ageha.cn) |
| CS 饰品虚拟投资模拟器 | 真实行情 + 虚拟资金的投资练习终端：定时采集、比价预警、模拟买卖、复盘回放 | 已上线 | [cs.ageha.cn](https://cs.ageha.cn) · [GitHub](https://github.com/Ageha6912/cs-market) |
| Moss World | 程序化生成的 3D 数字生态缸：光照湿度、成长系统与氛围预设，全程离线可用 | 可本地运行 | 无线上地址（未上线，不设入口） |

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

## 首页 3D 世界：Ageha 群岛

首页不再是传统 Hero + 卡片，而是一座可自由探索的原创 3D 世界
（`components/world/`，Three.js + React Three Fiber，SSR 安全 `ssr:false` 装载）：
主岛「苏醒环礁」上空悬浮品牌蝶枢，三条鳞粉蝶径分别通向三座作品之屿
（AgehaOS 悬浮终端塔 / CS 行情观测环 / Moss 生态穹舱），走近即有交互提示、
点击打开真实项目详情；主岛下方藏着「茧居所」设计原稿画廊彩蛋。
键盘（WASD / E / 1·2·3 / M / H）与触屏（虚拟摇杆 / 双指捏合）均可操控，
世界导航面板可直达任意项目与全部站点路由——探索不是获取信息的唯一路径。

**性能与降级**（阶段 4，`lib/world/performance.ts` 三档 + 帧率自适应）：

- 设备形态静态选初始档（桌面高 / 触屏中），此后按实测帧时间自动升降档
  （120 帧滑动窗口：平均 >22ms 持续 2s 降档、<14ms 持续 8s 升档、
  每次运行最多升 2 次防振荡），DPR / 阴影 / 粒子 / 远景 / 屏幕贴图逐档生效，
  档位变化在 HUD 一次性提示；
- WebGL 不可用 / 初始化失败 → 完整可访问的项目浏览降级页（`FallbackProjects`）；
  资源加载失败 → 「部分区域未能点亮」+ 重试 + 项目列表入口；图形上下文丢失
  → 恢复遮罩（不白屏、不静默）；
- `prefers-reduced-motion`：DOM 动画全局静止兜底之外，3D 帧循环内的环境动画
  （蝶枢开合 / 引导蝶巡飞 / 云漂移 / 行情柱滚动等）全部静止或瞬时完成，
  角色操控保持可用；
- 加载屏进度来自真实资产计数（drei `useProgress`），不用假百分比。

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

# 6. 测试套件（node --test，13 个测试文件 / 161 条断言用例）
npm test
```

以上命令均来自 `package.json` 的 `scripts` 字段，其中 `lint`、`test`、`build`
已在提交前于本机实际运行通过（0 告警 / 161 通过 0 失败 / 构建成功）。

## 目录结构

```
AgehaTech/
├── app/                        # Next.js App Router 路由
│   ├── page.tsx                # 首页：3D 世界入口（WorldShell，SSR 壳 + ssr:false Canvas）
│   ├── layout.tsx              # 根布局：Navbar / Footer / 键盘跳转链接
│   ├── globals.css             # @theme 设计令牌 + 玻璃拟态工具类 + 3D 世界沉浸层样式
│   ├── icon.svg                # 站点图标（蝴蝶 Logo）
│   ├── about/ · tech/ · articles/ · contact/   # 内容路由页（含各自 metadata）
│   └── projects/
│       ├── page.tsx            # 项目列表页
│       └── [slug]/page.tsx     # 项目详情页（generateStaticParams SSG ×3）
├── components/
│   ├── world/                  # 3D 世界（WorldShell / WorldCanvas / 地形 / 信灯控制器 /
│   │                           #   跟随相机 / 交互与传送系统 / 项目屿与茧居所 /
│   │                           #   详情·导航·说明三面板 / HUD / 摇杆 / WebGL 降级页）
│   ├── home/                   # 保留版块（AboutSection / JourneySection / TechStackSection / ContactSection，内页复用）
│   ├── layout/                 # Navbar / Footer / ButterflyLogo / PageHeader / 导航数据模型
│   ├── projects/ProjectCard.tsx
│   └── ui/                     # GlassCard / GlassPanel / GlassButton / Badge / SectionHeading
├── lib/                        # 集中管理的数据与配置（站点配置 / 项目 / 文章计划 / 技术栈）
├── lib/world/                  # 3D 世界纯 TS 数据层（布局坐标 / 碰撞与交互登记 / 传送目标 / 性能档位）
├── scripts/prepare-world-assets.mjs  # 世界资产预处理（内置 sharp：屏幕贴图 / 蝶精灵 / 画廊压缩版）
├── tests/                      # node:test 契约测试（结构 / 路由 / 设计系统 / 对比度 / 诚实边界 / 世界布局与资产…）
├── public/images/              # Hero 场景插画 + 项目真实界面截图 + 关于照片（见下表）
├── public/world/               # 世界资产产物（三屿屏幕贴图 / 蝶精灵 / 画廊压缩版，脚本生成入库）
├── docs/                       # 3D 世界重构简报与施工蓝图（权威文档）
├── Ageha.tech未来数字世界作品集.png   # 设计参考原图（仓库根目录）
├── _assets/                    # 参考图裁切素材源（仅本地，不入库）
└── Discarded proposal/         # 废案文件夹（仅本地，不入库）
```

## 素材与占位说明

`public/images/` 中入库的六张素材分两类 —— **项目封面为真实界面截图**，
参考图裁切产物仅用于场景插画与「关于我」照片位（仍是概念视觉，非真实照片）。
参考图裁切的源文件存放在本地 `_assets/`（已被 `.gitignore` 排除）：

| 文件 | 用途 | 引用位置 | 素材性质 |
| --- | --- | --- | --- |
| `hero-clean.png` | 参考图裁切场景插画（水晶蝴蝶 + 悬浮尖塔城市） | 茧居所画廊压缩版来源（`scripts/prepare-world-assets.mjs` → `public/world/gallery/`） | 参考图裁切的概念视觉 |
| `hero-full.png` | 完整版场景图（备用素材） | 同上（画廊压缩版来源） | 参考图裁切的概念视觉 |
| `about-photo.png` | 「关于我」版块照片位 | `components/home/AboutSection.tsx` | 参考图裁切，**非真实个人照片** |
| `agehaos-desktop.jpg` | AgehaOS 封面 | `lib/projects.ts` → 项目卡片 / 详情页 | **真实界面截图**（取自 AgehaOS 仓库桌面截图） |
| `cs-market-portfolio.png` | CS 饰品虚拟投资模拟器封面 | 同上 | **真实界面截图**（取自 cs.ageha.cn 线上投资组合页） |
| `moss-world-terrarium.png` | Moss World 封面 | 同上 | **真实界面截图**（本地运行实拍） |

### 内容占位（诚实边界）

以下边界由 `tests/content-honesty.test.mjs` 数值级守护：

- **联系方式**（`lib/site.ts`）：GitHub 已接入站长真实账号
  [Ageha6912](https://github.com/Ageha6912)（与 CS 模拟器公开仓库同源）；
  邮箱与其他平台仍为「待配置」占位，页面上不出现任何虚构外链；
- **项目**（`lib/projects.ts`）：状态与入口链接只来自各项目仓库 README 的事实
  （已上线 → 在线体验 / 源码链接；未上线 → 「可本地运行」且不设任何入口），
  外链域名受测试白名单约束（ageha.cn 系与 github.com/Ageha6912）；
  不写日期、不写成果指标；
- **文章**（`lib/notes.ts`）：三条均为「写作计划中」的占位条目，
  无日期、无阅读量、无链接；
- **探索时间线**（JourneySection，/about 路由页渲染）：不含任何年份。

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
| `structure.test.mjs` | 首页世界入口（WorldShell + ssr:false + lib/world）、组件退役边界、SSG 参数、导航单源 |
| `routes.test.mjs` | 六个内页 metadata、诚实边界、图片一律 `next/image` |
| `design-system.test.mjs` | `@theme` 设计令牌与玻璃拟态类的存在与消费 |
| `contrast.test.mjs` | WCAG 对比度数值级回归（真实叠层 alpha 合成计算，含世界 HUD） |
| `responsive-perf.test.mjs` | 断点 / 触控面积 / 焦点环 / 性能档位与帧率自适应 / 移动端交互放大 / 输入与 GPU 资源清理审计 / reduced-motion 全覆盖 / 上下文丢失与加载失败降级 |
| `hero.test.mjs` | 世界品牌标题与引导卡文案（原 Hero 契约迁移新家）、加载屏真实进度、Logo 接口、无 emoji |
| `home-sections.test.mjs` / `sections.test.mjs` | 版块数据单源、世界详情/导航面板数据同源与 Moss 诚实空链、无年份承诺 |
| `content-honesty.test.mjs` | 数据级诚实边界：外链白名单 / 无日期 / 联系渠道「待配置」/ 世界层零外链 |
| `world-layout.test.mjs` | 世界坐标级校验：蝶径与茧居所旋径、多层地形、交互登记、碰撞体、传送落点、屏幕贴图登记、性能档位 |
| `world-assets.test.mjs` | 世界资产纪律：客户端组件、禁 troika Text、零外链、无裸 img、§11.2 产物体积上限 |
| `site.test.mjs` | 站点配置、`.gitignore` 必含项、素材非空 |
| `readme.test.mjs` | README 与仓库真实状态一致（命令 / 素材表 / 占位说明） |
