import type { Project } from "./content-types";

/**
 * 精选项目数据（集中管理，FeaturedProjects 版块与 /projects 路由消费）。
 *
 * 【诚实边界】以下内容全部来自站长提供的项目仓库（E:/AgehaOS、E:/CS market、
 * E:/Vibe Project/Moss World）的 README 与真实产物，逐项有据可查：
 * - AgehaOS 已上线 os.ageha.cn，CS 饰品虚拟投资模拟器已上线 cs.ageha.cn
 *   （并公开于 github.com/Ageha6912/cs-market），二者状态如实写「已上线」；
 * - Moss World 仓库可运行但没有上线记录，状态如实写「可本地运行」，不设任何链接；
 * - 封面为三个项目的真实界面截图（AgehaOS 桌面 / CS 线上投资组合页 /
 *   Moss World 本地运行画面），coverAlt 如实描述；
 * - 技术标签取自各仓库实际依赖，不含未经使用的名词；
 * - 不写日期、成果指标或任何仓库 README 之外的宣称。
 */
export const projects: readonly Project[] = [
  {
    slug: "agehaos",
    name: "AgehaOS",
    category: "Web OS · Desktop Experience",
    description:
      "运行在浏览器里的操作系统式 Web OS：桌面与移动端共享同一套 OS Core——窗口管理器、虚拟文件系统、App Store 沙箱运行时与全局搜索，并带有 AI 动态桌面与「羽化」实时生成应用能力。",
    tags: ["React 19", "TypeScript", "Vite", "Zustand", "Tailwind CSS 4"],
    cover: "/images/agehaos-desktop.jpg",
    coverAlt:
      "AgehaOS 桌面真实界面截图：蝴蝶湖畔壁纸，左侧 Workspace Rail、右侧系统状态中心、中央品牌层与底部波浪 Dock",
    coverKind: "real",
    status: "已上线",
    links: [{ label: "在线体验", href: "https://os.ageha.cn", external: true }],
  },
  {
    slug: "cs-skin-invest",
    name: "CS 饰品虚拟投资模拟器",
    category: "Market Data · Virtual Trading",
    description:
      "真实市场行情 + 虚拟资金的投资练习终端：悠悠有品与 Skinport 行情定时采集入库，多平台比价、价格预警，用虚拟资金模拟买卖并沉淀资产曲线、收益复盘与历史行情回放，交易由服务端事务保障。",
    tags: ["Next.js 15", "FastAPI", "ECharts", "SQLAlchemy"],
    cover: "/images/cs-market-portfolio.png",
    coverAlt:
      "CS 饰品虚拟投资模拟器线上真实界面：投资组合页的总资产、资产曲线、组合分析与当前持仓",
    coverKind: "real",
    status: "已上线",
    links: [
      { label: "在线体验", href: "https://cs.ageha.cn", external: true },
      {
        label: "查看源码",
        href: "https://github.com/Ageha6912/cs-market",
        external: true,
      },
    ],
  },
  {
    slug: "moss-world",
    name: "Moss World",
    category: "Interactive Web · Digital Ecosystem",
    description:
      "跑在浏览器里的 3D 数字生态缸：玻璃缸、苔藓地形与植物全部由程序化几何生成（无模型、无贴图），支持光照湿度调节、喷洒水雾、快进成长与氛围预设，进度只保存在本地设备。",
    tags: ["Next.js 15", "Three.js", "React Three Fiber", "Zustand"],
    cover: "/images/moss-world-terrarium.png",
    coverAlt:
      "Moss World 真实运行画面：玻璃缸中的程序化苔藓生态与右侧环境控制台（光照、湿度与成长状态）",
    coverKind: "real",
    status: "可本地运行",
  },
];
