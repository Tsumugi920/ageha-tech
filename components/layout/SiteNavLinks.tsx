"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  NAV_LINKS,
  isNavLinkActive,
  type NavLinkItem,
} from "./navigation";

type NavAnchorProps = {
  item: NavLinkItem;
  pathname: string | null;
  className?: string;
  activeClassName?: string;
  onNavigate?: () => void;
};

/**
 * 单个导航项：内容路由 <Link>（首页 3D 化后全站统一路由链接，
 * 不再有页内锚点形态）；命中当前路由的项加高亮与 aria-current。
 */
function NavAnchor({
  item,
  pathname,
  className,
  activeClassName,
  onNavigate,
}: NavAnchorProps) {
  const active = isNavLinkActive(item, pathname);
  const classes = cn(className, active && activeClassName);

  return (
    <Link
      href={item.href}
      className={classes}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {item.label}
    </Link>
  );
}

/* 导航条胶囊项：默认态与当前路由高亮态（内描边避免布局抖动）。
   激活态文字用加深档 --color-link：品牌蓝 #269DFF 在白75激活底上仅 2.76:1，
   不达 14px 文字 4.5:1（AA）；tap-44 将 32px 高的胶囊命中区外扩到 ≥44px，
   左右不外扩（--tap-extend-x:0），避免与相邻胶囊的命中区重叠 */
const BAR_ITEM =
  "tap-44 rounded-full px-3.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/70 hover:text-text-primary [--tap-extend-x:0px]";
const BAR_ITEM_ACTIVE =
  "bg-white/75 text-link shadow-[inset_0_0_0_1px_rgba(26,100,190,0.32)]";

/* 移动菜单行项：更大的纵向触控面积（≥44px） */
const SHEET_ITEM =
  "flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium text-text-secondary transition-colors hover:bg-white/60 hover:text-text-primary";
const SHEET_ITEM_ACTIVE =
  "bg-white/70 text-link shadow-[inset_0_0_0_1px_rgba(26,100,190,0.28)]";

type NavLinksProps = {
  /** bar：桌面胶囊行；sheet：移动端展开菜单的纵向列表 */
  layout: "bar" | "sheet";
  /** 点击导航项后的回调（Navbar 用于收起移动端菜单） */
  onNavigate?: () => void;
};

/**
 * 导航条链接组（<li> 条目，置于 Navbar 的 <ul> 内）：
 * 数据与高亮判定来自 ./navigation.ts，与页脚共用同一份 NAV_LINKS。
 */
export function NavLinks({ layout, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <>
      {NAV_LINKS.map((item) => (
        <li key={item.href}>
          <NavAnchor
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
            className={layout === "bar" ? BAR_ITEM : SHEET_ITEM}
            activeClassName={layout === "bar" ? BAR_ITEM_ACTIVE : SHEET_ITEM_ACTIVE}
          />
        </li>
      ))}
    </>
  );
}

/**
 * 页脚链接组：与导航条共用同一份 NAV_LINKS 数据与高亮判定，
 * 保证页脚链接始终与顶部导航对齐。
 */
export function FooterNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_LINKS.map((item) => (
        <NavAnchor
          key={item.href}
          item={item}
          pathname={pathname}
          /* py-3：链接行高凑足 44px 触控行（网格行距 10px，不与相邻行重叠）；
             hover/激活态用加深档 --color-link，保证 ≥4.5:1 */
          className="py-3 text-sm font-medium text-text-secondary transition-colors hover:text-link"
          activeClassName="font-semibold text-link"
        />
      ))}
    </>
  );
}
