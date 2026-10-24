/**
 * 站点全局配置：品牌、身份、导航与联系方式。
 *
 * 【诚实占位说明】所有联系方式均为「待配置」占位，
 * 在站长提供真实账号前，绝不虚构任何邮箱 / 社交链接。
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
  /** 首页导航项（锚点路由） */
  navItems: [
    { label: "首页", href: "#home" },
    { label: "项目", href: "#projects" },
    { label: "关于", href: "#about" },
    { label: "技术栈", href: "#tech" },
    { label: "文章", href: "#notes" },
  ] satisfies NavItem[],
  /**
   * 联系方式占位：一律 { label, value: "待配置" } 形式，
   * 绝不填入真实账号。
   */
  contacts: [
    { label: "GitHub", value: "待配置" },
    { label: "Email", value: "待配置" },
    { label: "X / Twitter", value: "待配置" },
    { label: "Bilibili", value: "待配置" },
  ] satisfies ContactItem[],
} as const;

export type SiteConfig = typeof site;
