import { ButterflyLogo } from "./ButterflyLogo";
import { Badge } from "@/components/ui/Badge";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { site } from "@/lib/site";

/**
 * 页脚：Logo + 品牌短句 + 身份徽章 + 站内导航 + 版权行。
 */
export function Footer() {
  return (
    <footer className="px-4 pb-10 pt-24 md:px-8">
      <GlassPanel className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <ButterflyLogo gradientId="footer-butterfly" className="size-9" />
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
            {site.navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-text-secondary transition-colors hover:text-blue"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-10 border-t border-line pt-6 text-center text-xs text-text-muted">
          © 2026 Ageha.tech · {site.tagline}
        </div>
      </GlassPanel>
    </footer>
  );
}
