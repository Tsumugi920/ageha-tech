/**
 * 站点全局配置：品牌、身份、导航与联系方式。
 *
 * 【诚实边界】GitHub 为站长真实账号（github.com/Ageha6912，与 CS 模拟器
 * 公开仓库同源）；其余渠道在站长提供真实账号前保持 { value: "待配置" }
 * 占位数据，绝不虚构任何邮箱 / 社交链接。数据层的 configured 开关决定
 * 渲染：未配置的入口在联系区直接隐藏，不以「待配置」当正式内容展示。
 */

export type NavItem = {
  label: string;
  href: string;
};

export type ContactItem = {
  label: string;
  /** 占位值统一为「待配置」，接入真实账号后逐项替换 */
  value: string;
  href?: string;
  /** 配置开关：true 才会在联系区渲染；未配置的入口直接隐藏 */
  configured: boolean;
};

export const site = {
  /** 品牌名 */
  name: "Ageha.tech",
  /** 身份标签 */
  identity: "INDEPENDENT DIGITAL CREATOR",
  /** 中文短句（与 metadata 一致） */
  tagline: "用技术构建更有趣的数字世界",
  /** 品牌英文短句（Footer 使用） */
  brandLine: "Building digital things with curiosity.",
  /** 站点描述 */
  description:
    "Ageha.tech — 独立数字创作者的数字花园：项目作品、技术栈与写作札记（正在建设中）。",
  /**
   * 导航项（内容路由链接）。
   * 首页 3D 化后不再有页内版块锚点（#projects/#about… 已随版块退役），
   * 全站导航统一走路由链接——首页与其他页行为一致（蓝图 §10 Navbar
   * 结构不动；锚点失效问题的处置记录见 docs/3d-world-blueprint.md 评审意见）。
   */
  navItems: [
    { label: "首页", href: "/" },
    { label: "项目", href: "/projects" },
    { label: "关于", href: "/about" },
    { label: "技术栈", href: "/tech" },
    { label: "文章", href: "/articles" },
  ] satisfies NavItem[],
  /**
   * 联系方式：GitHub 已接入真实账号（有据可查，configured: true）；
   * 其余渠道保持 { value: "待配置", configured: false } 占位——
   * 数据留档、渲染隐藏，绝不虚构。
   */
  contacts: [
    {
      label: "GitHub",
      value: "Ageha6912",
      href: "https://github.com/Ageha6912",
      configured: true,
    },
    { label: "邮箱", value: "待配置", configured: false },
    { label: "其他平台", value: "待配置", configured: false },
  ] satisfies ContactItem[],
} as const;

export type SiteConfig = typeof site;
