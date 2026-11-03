import { ButterflyLogo } from "./ButterflyLogo";
import { FooterNavLinks } from "./SiteNavLinks";
import { Badge } from "@/components/ui/Badge";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { site } from "@/lib/site";

/**
 * 页脚：Logo + 品牌短句 + 身份徽章 + 站内导航 + 版权行。
 * 导航链接与顶部导航共用同一份数据与解析逻辑（SiteNavLinks.FooterNavLinks）：
 * 首页为页内锚点，其他页为内容路由链接并高亮当前路由。
 */
export function Footer() {
  return (
    <footer className="pb-10 pt-16 md:px-(--site-gutter)">
      <GlassPanel className="site-container px-6 py-10 md:px-7">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-4">
            <div className="flex items-center gap-2.5">
              {/* Logo 为纯装饰：相邻已有可见品牌文字「Momori」，避免读屏重复播报 */}
              <ButterflyLogo
                gradientId="footer-butterfly"
                className="size-9"
                decorative
              />
              <span className="font-display text-xl font-bold tracking-tight text-text-primary">
                {site.name}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">
              {site.brandLine}
            </p>
            <Badge>{site.identity}</Badge>
          </div>

          {/* 页脚导航：两列三行（与左列品牌栏高度 ≈对齐，避免单列 6 行
              在左列下方留出大段空白玻璃底；链接行本身仍为 44px 触控行） */}
          <nav aria-label="页脚导航" className="grid grid-cols-2 gap-x-10 gap-y-2.5 self-center sm:gap-x-14 md:self-start">
            <FooterNavLinks />
          </nav>
        </div>

        {/* 版权行 12px 小字：text-muted #6F86A4 在玻璃底仅 3.48:1，
            正文阈值 4.5:1，用 text-secondary（实测 5.49:1） */}
        <div className="mt-10 border-t border-line pt-6 text-center text-xs text-text-secondary">
          © 2026 {site.name} · {site.tagline}
        </div>
      </GlassPanel>
    </footer>
  );
}
