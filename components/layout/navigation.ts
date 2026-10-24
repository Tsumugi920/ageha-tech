import { site, type NavItem } from "@/lib/site";

/**
 * 站内导航数据模型：lib/site.ts 的 navItems 提供锚点语义（首页内跳转），
 * 这里为每个锚点补充对应的内容路由页（站点补全路由后两套入口一一对应）。
 *
 * - 首页（/）：导航项渲染为页内锚点（#projects、#about …），平滑滚动；
 * - 其他页面：导航项渲染为路由链接（/projects、/about …），当前路由高亮。
 */

export type NavLinkItem = NavItem & {
  /** 锚点对应的内容路由页（首页项为 "/"） */
  path: string;
};

/** 首页锚点 → 内容路由页映射（含「文章」锚点 → /articles 写作计划页） */
const ROUTE_BY_HASH: Record<string, string> = {
  "#home": "/",
  "#projects": "/projects",
  "#about": "/about",
  "#tech": "/tech",
  "#notes": "/articles",
};

export const NAV_LINKS: readonly NavLinkItem[] = site.navItems.map((item) => ({
  ...item,
  path: ROUTE_BY_HASH[item.href] ?? "/",
}));

/** 是否位于首页（首页内锚点直接生效） */
export function isHomePathname(pathname: string | null): boolean {
  return !pathname || pathname === "/";
}

/**
 * 解析导航项的实际 href：
 * 首页返回页内锚点（原生 <a> 平滑滚动）；其他页返回路由地址（用 next/link）。
 */
export function resolveNavLinkHref(
  item: NavLinkItem,
  pathname: string | null,
): { href: string; isRouteLink: boolean } {
  if (isHomePathname(pathname)) {
    return { href: item.href, isRouteLink: false };
  }
  return { href: item.path, isRouteLink: true };
}

/**
 * 当前路由高亮判定：
 * - 首页高亮「首页」项；
 * - 其他页按路由前缀匹配（/projects/xxx 也会高亮「项目」）。
 */
export function isNavLinkActive(
  item: NavLinkItem,
  pathname: string | null,
): boolean {
  if (!pathname || isHomePathname(pathname)) return item.path === "/";
  if (item.path === "/") return false;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}
