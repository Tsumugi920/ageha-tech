import { ButterflyLogo } from "./ButterflyLogo";
import { GlassButton } from "@/components/ui/GlassButton";
import { site } from "@/lib/site";

/**
 * 顶部导航（本轮静态版）：玻璃胶囊底座 + 蝴蝶 Logo 占位 + 锚点导航 + 联系我按钮。
 * 移动端菜单与滚动状态留待后续迭代。
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-4 md:px-8">
      <nav
        aria-label="站内主导航"
        className="glass-panel mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full py-2.5 pl-5 pr-2.5"
      >
        <a
          href="#home"
          className="flex shrink-0 items-center gap-2.5"
          aria-label={`${site.name} 首页`}
        >
          <ButterflyLogo gradientId="navbar-butterfly" className="size-8" />
          <span className="font-display text-lg font-bold tracking-tight text-text-primary">
            {site.name}
          </span>
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {site.navItems.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/70 hover:text-text-primary"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <GlassButton href="#contact" className="shrink-0 px-4 py-2 text-sm">
          联系我
        </GlassButton>
      </nav>
    </header>
  );
}
