import type { Project } from "./content-types";

/**
 * 精选项目数据（集中管理，FeaturedProjects 版块消费）。
 *
 * 【诚实边界】三个项目均为「正在构建 / 持续打磨 / 技术探索」中的作品：
 * - 不虚构上线状态、演示链接、源码链接与日期；
 * - 描述统一采用「探索 / 尝试」的过程性表述，不写成成果宣言；
 * - 封面为参考图裁切的概念视觉占位（非真实运行界面），coverAlt 如实标注。
 */
export const projects: readonly Project[] = [
  {
    slug: "agehaos",
    name: "AgehaOS",
    category: "Web OS · Desktop Experience",
    description:
      "探索 Web 操作系统的桌面环境、窗口管理与交互体验，尝试将系统级界面的设计理念带入浏览器。",
    tags: ["TypeScript", "Next.js", "Tailwind CSS"],
    cover: "/images/cover-agehaos.png",
    coverAlt:
      "AgehaOS 概念视觉占位：紫蓝色调的 Web 桌面系统界面参考图拼贴（非真实运行界面）",
  },
  {
    slug: "cs-skin-invest",
    name: "CS 饰品虚拟投资模拟器",
    category: "Data Visualization · Simulation",
    description:
      "围绕 CS 饰品市场数据，探索虚拟持仓、价格走势、资产表现与投资模拟体验。",
    tags: ["React", "Chart.js", "Python"],
    cover: "/images/cover-cs.png",
    coverAlt:
      "CS 饰品虚拟投资模拟器概念视觉占位：暗色交易仪表盘与红蓝价格图表参考图（非真实运行界面）",
  },
  {
    slug: "moss-world",
    name: "Moss World",
    category: "Interactive Web · Digital Ecosystem",
    description:
      "通过交互式数字生态体验，探索自然主题、环境变化与沉浸式 Web 视觉表达。",
    tags: ["Three.js", "WebGL", "React"],
    cover: "/images/cover-moss.png",
    coverAlt:
      "Moss World 概念视觉占位：绿色苔藓生态球微缩景观参考图（非真实运行界面）",
  },
];
