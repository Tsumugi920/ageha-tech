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
    <footer className="px-4 pb-10 pt-24 md:px-8">
      <GlassPanel className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-4">
            <div className="flex items-center gap-2.5">
              {/* Logo 为纯装饰：相邻已有可见品牌文字「Ageha.tech」，避免读屏重复播报 */}
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

          <nav aria-label="页脚导航" className="grid grid-cols-2 gap-x-14 gap-y-2.5 sm:grid-cols-1">
            <FooterNavLinks />
          </nav>
        </div>

        {/* 版权行 12px 小字：text-muted #6F86A4 在玻璃底仅 3.48:1，
            正文阈值 4.5:1，用 text-secondary（实测 5.49:1） */}
        <div className="mt-10 border-t border-line pt-6 text-center text-xs text-text-secondary">
          © 2026 Ageha.tech · {site.tagline}
        </div>
      </GlassPanel>
    </footer>
  );
}
