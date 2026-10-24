"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ButterflyLogo } from "./ButterflyLogo";
import { NavLinks } from "./SiteNavLinks";
import { GlassButton } from "@/components/ui/GlassButton";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * 顶部导航（完整实现）：
 * - 当前路由高亮：首页高亮「首页」，其他页按路由前缀匹配（/projects/xxx 高亮「项目」）；
 * - 首页内锚点（#projects、#about 等）原生效：首页上导航项就是页内锚点，
 *   其他页则切换为对应内容路由页（/projects、/about …），滚动后玻璃底座
 *   背景透明度轻微提升（0.48 → 0.70 白）；
 * - 移动端汉堡菜单可展开 / 关闭：44px 触控按钮、条目 ≥44px 高、
 *   Esc 关闭、路由变化自动收起、关闭态 inert 不可聚焦。
 */
export function Navbar() {
  const pathname = usePathname();
  const isHome = !pathname || pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // 路由变化自动收起移动端菜单（渲染期调整状态，覆盖浏览器前进 / 后退）
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  // 滚动后轻微加深玻璃底座（透明度变化克制，保持玻璃质感）
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Esc 关闭移动端菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const brand = (
    <>
      {/* Logo 为纯装饰：链接自带 aria-label，旁边又有可见品牌文字，
          role=img + aria-label 会被部分读屏器重复播报 */}
      <ButterflyLogo
        gradientId="navbar-butterfly"
        className="size-8"
        decorative
      />
      <span className="font-display text-lg font-bold tracking-tight text-text-primary">
        {site.name}
      </span>
    </>
  );

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 md:px-8">
      <nav
        aria-label="站内主导航"
        className={cn(
          "glass-panel mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full py-2.5 pl-5 pr-2.5 transition-[background-color,box-shadow] duration-300",
          scrolled && "bg-white/70 shadow-[0_12px_36px_rgba(71,115,183,0.18)]",
        )}
      >
        {/* 品牌：首页回页首锚点，其他页回首页（tap-44 外扩命中区至 ≥44px） */}
        {isHome ? (
          <a
            href="#home"
            className="tap-44 flex shrink-0 items-center gap-2.5"
            aria-label={`${site.name} 首页`}
          >
            {brand}
          </a>
        ) : (
          <Link
            href="/"
            className="tap-44 flex shrink-0 items-center gap-2.5"
            aria-label={`${site.name} 首页`}
          >
            {brand}
          </Link>
        )}

        {/* 桌面导航：首页为页内锚点，其他页为路由链接并高亮当前路由 */}
        <ul className="hidden list-none items-center gap-1 lg:flex">
          <NavLinks layout="bar" />
        </ul>

        <div className="flex shrink-0 items-center gap-1.5">
          <GlassButton
            href="/contact"
            /* max-sm:hidden：媒体作用域的 hidden 才能压过 GlassButton 基类的
               inline-flex（裸 hidden 与基类 display 同级联时按输出顺序落败） */
            className="max-sm:hidden min-h-11 px-4 py-2 text-sm"
          >
            联系我
          </GlassButton>

          {/* 移动端汉堡按钮：44px 触控面积 */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={menuOpen ? "收起菜单" : "展开菜单"}
            className="inline-grid size-11 place-items-center rounded-full text-text-primary transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring lg:hidden"
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* 移动端菜单面板（lg 以下）：绝对定位悬浮展开，不挤压页面内容 */}
      <div
        id="mobile-nav-menu"
        inert={!menuOpen}
        className={cn(
          "glass-panel absolute inset-x-4 top-full mt-2 max-w-6xl overflow-hidden rounded-3xl transition-[max-height,opacity] duration-300 ease-out lg:hidden md:inset-x-8",
          menuOpen
            ? "max-h-[28rem] bg-white/75 opacity-100"
            : "pointer-events-none max-h-0 opacity-0",
        )}
      >
        <ul className="list-none space-y-1 p-3">
          <NavLinks layout="sheet" onNavigate={closeMenu} />
        </ul>
        <div className="p-3 pt-1">
          <GlassButton
            href="/contact"
            onClick={closeMenu}
            className="w-full py-3"
          >
            联系我
          </GlassButton>
        </div>
      </div>
    </header>
  );
}
