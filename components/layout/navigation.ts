import { site, type NavItem } from "@/lib/site";

/**
 * 站内导航数据模型：导航项单源 lib/site.ts 的 navItems（内容路由链接）。
 *
 * 首页 3D 化后不再有页内版块锚点，全站统一走路由链接：
 * - 所有页面（含首页）：导航项渲染为路由 <Link>，当前路由高亮；
 * - 世界内的探索 / 传送 / 快捷入口由 HUD 与世界导航面板承担（阶段 2+）。
 */

export type NavLinkItem = NavItem;

export const NAV_LINKS: readonly NavLinkItem[] = site.navItems;

/**
 * 当前路由高亮判定：
 * - 首页（"/"）仅高亮「首页」项；
 * - 其他页按路由前缀匹配（/projects/xxx 也会高亮「项目」）。
 */
export function isNavLinkActive(
  item: NavLinkItem,
  pathname: string | null,
): boolean {
  const isHome = !pathname || pathname === "/";
  if (isHome) return item.href === "/";
  if (item.href === "/") return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
