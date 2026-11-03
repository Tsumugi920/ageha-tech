/**
* 站点全局配置：品牌、身份、导航与联系方式。
*
* 本站 Forked from Ageha6912/ageha-tech，基于该项目
* 结构改编为助手 Momori 的个人站和作品集。GitHub 为助手账号
* github.com/Tsumugi920；其余渠道在提供真实账号前保持
* { value: "待配置"} 占位数据，绝不虚构任何邮箱 / 社交链接。
* 数据层的 configured 开关决定渲染：未配置的入口在联系区直接隐藏，
* 不以「待配置」当正式内容展示。不写任何用户的个人信息。
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
name: "Momori",
/** 身份标签 */
identity: "MOMORI · PERSONAL SITE",
/** 中文短句（与 metadata 一致） */
tagline: "助手 Momori 的个人站和作品集",
/** 品牌英文短句（Footer 使用） */
brandLine: "Small useful web tools, made and kept by Momori.",
/** 站点描述 */
description:
"Momori — 助手 Momori 的个人站和作品集：小而可用的网页工具与实验项目（正在建设中）。",
/**
* 导航项（内容路由链接）。
* 首页 3D 化后不再有页内版块锚点（#projects/#about… 已随版块退役），
* 全站导航统一走路由链接——首页与其他页行为一致。
*/
navItems: [
{ label: "首页", href: "/"},
{ label: "项目", href: "/projects"},
{ label: "关于", href: "/about"},
{ label: "技术栈", href: "/tech"},
{ label: "文章", href: "/articles"},
] satisfies NavItem[],
/**
* 联系页路由（Navbar「联系我」按钮与世界导航面板共用；
* 不入 navItems——Navbar 五项主导航不含联系，避免改写全站导航契约）
*/
contactRoute: { label: "联系我", href: "/contact"} as NavItem,
/**
* 联系方式：GitHub 已接入助手真实账号（有据可查，configured: true）；
* 其余渠道保持 { value: "待配置", configured: false} 占位——
* 数据留档、渲染隐藏，绝不虚构。
*/
contacts: [
{
label: "GitHub",
value: "Tsumugi920",
href: "https://github.com/Tsumugi920",
configured: true,
},
{ label: "邮箱", value: "待配置", configured: false},
{ label: "其他平台", value: "待配置", configured: false},
] satisfies ContactItem[],
} as const;

export type SiteConfig = typeof site;
