import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowUpRight, Cat, Mail, Network } from "lucide-react";
import { ButterflyLogo } from "@/components/layout/ButterflyLogo";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { site } from "@/lib/site";

/**
 * 联系渠道：数据单源于 lib/site.ts 的 contacts，按 configured 配置开关渲染——
 * 只有已接入的渠道（当前仅 GitHub 真实账号）会出现；未配置的入口直接隐藏
 * （占位值仅存于数据层），绝不虚构任何邮箱或社交账号。
 */
const CHANNEL_ICONS: Record<string, LucideIcon> = {
  GitHub: Cat,
  邮箱: Mail,
  其他平台: Network,
};

/** 星尘：静态点缀，落在暮光较深的区段，浅色天空处自然隐去（装饰性，外层 aria-hidden） */
const STARS = [
  { cx: 60, cy: 40, r: 1.4, o: 0.9 },
  { cx: 150, cy: 96, r: 1, o: 0.6 },
  { cx: 240, cy: 26, r: 0.9, o: 0.5 },
  { cx: 330, cy: 70, r: 1.2, o: 0.75 },
  { cx: 420, cy: 20, r: 0.8, o: 0.45 },
  { cx: 505, cy: 88, r: 1.1, o: 0.65 },
  { cx: 590, cy: 34, r: 1.5, o: 0.85 },
  { cx: 680, cy: 108, r: 0.9, o: 0.5 },
  { cx: 760, cy: 52, r: 1.2, o: 0.7 },
  { cx: 850, cy: 24, r: 1, o: 0.6 },
  { cx: 940, cy: 84, r: 1.3, o: 0.75 },
  { cx: 1030, cy: 40, r: 0.9, o: 0.5 },
  { cx: 1120, cy: 92, r: 1.4, o: 0.8 },
  { cx: 1180, cy: 20, r: 1, o: 0.6 },
  { cx: 100, cy: 150, r: 0.8, o: 0.4 },
  { cx: 300, cy: 140, r: 0.9, o: 0.4 },
  { cx: 540, cy: 160, r: 0.8, o: 0.35 },
  { cx: 800, cy: 150, r: 1, o: 0.45 },
  { cx: 1060, cy: 156, r: 0.9, o: 0.4 },
  { cx: 460, cy: 120, r: 0.7, o: 0.35 },
  { cx: 720, cy: 128, r: 0.8, o: 0.4 },
  { cx: 980, cy: 126, r: 0.7, o: 0.35 },
] as const;

/**
 * 暮光天幕：冰蓝 → 柔和蓝紫 → 深空暮光的连续渐变（无硬切、无突兀色块），
 * 深空区保留少量星尘、远山与光晕，末段缓缓回到天光与页脚衔接。
 * 色标含 #1E3762 / #152A50 深海军蓝（品牌夜色锚点，测试锚定）。
 */
const DUSK_BG = [
  "radial-gradient(52rem 22rem at 78% 64%, rgba(156,131,255,0.20), transparent 68%)",
  "radial-gradient(46rem 18rem at 62% 76%, rgba(84,227,255,0.12), transparent 70%)",
  "radial-gradient(38rem 16rem at 20% 72%, rgba(84,227,255,0.10), transparent 72%)",
  "linear-gradient(180deg, #F1F8FF 0%, #E2EEFB 8%, #C7DCF7 18%, #A9BCF0 28%, #8B9AE6 38%, #6C7BD6 48%, #4A57AC 58%, #1E3762 72%, #152A50 82%, #1E2A55 88%, #3E4D96 94%, #E9F2FC 100%)",
].join(", ");

/**
 * 联系我：整段坐在暮光天幕上 —— 天幕自身完成冰蓝 → 柔和蓝紫 → 深空暮光
 * → 天光的连续过渡（渐变都发生在天幕内，与上文浅色内容和页脚无断点）；
 * 内容统一收进一条实底浅玻璃幕带（design tokens：bg-glass-strong + glass 边框），
 * 深墨正文在暮光任一区段都可读 —— 不出现突兀的深色矩形，页脚保持品牌亮玻璃。
 * 左文字块（眉题 + 大标题 + 段落 + 青色渐变 CTA → /contact）
 * + 渠道列表（单源 site.contacts，configured 开关过滤，GitHub 真实账号新窗口打开）
 * + 右侧玻璃小卡（英文短句 + 蝴蝶点缀）。
 */
export function ContactSection() {
  return (
    <section
      id="contact"
      aria-label="联系我"
      className="relative isolate scroll-mt-24 overflow-hidden"
    >
      {/* 暮光天幕：连续渐变 + 星尘 + 远山剪影（装饰层） */}
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: DUSK_BG }} />
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 340"
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-0 -z-10 h-full w-full"
      >
        {STARS.map((star) => (
          <circle
            key={`${star.cx}-${star.cy}`}
            cx={star.cx}
            cy={star.cy}
            r={star.r}
            fill="#FFFFFF"
            opacity={star.o}
          />
        ))}
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 -z-10 h-28 w-full sm:h-36"
      >
        {/* 远景山脊剪影：低透明度融入暮光，不与天幕争抢对比 */}
        <path
          d="M0 200 V120 L120 84 L260 118 L420 78 L580 116 L760 82 L920 118 L1080 92 L1200 112 V200 Z"
          fill="#1A2E55"
          opacity="0.45"
        />
        <path
          d="M0 200 V150 L160 122 L320 152 L500 118 L680 150 L860 124 L1040 152 L1200 132 V200 Z"
          fill="#0A1730"
          opacity="0.55"
        />
      </svg>

      {/* 浅玻璃幕带：实底（bg-glass-strong），暮光任一区段上深墨正文均可读 */}
      <div className="site-container py-20 lg:py-22">
        <GlassPanel className="bg-glass-strong p-6 sm:p-8">
          <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,2.25fr)_minmax(0,1.25fr)]">
            {/* 左：文字块 */}
            <div className="flex flex-col items-start justify-center gap-4 lg:pr-2">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-text-primary">
                Contact
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
                有一个想法？
              </h2>
              <p className="max-w-md text-sm leading-loose text-text-primary md:text-[15px]">
                如果你对我的作品感兴趣，或者有值得一起探索的想法，欢迎通过以下方式联系我。
              </p>
              <a
                href="/contact"
                className="group inline-flex items-center gap-2 rounded-full bg-[linear-gradient(102deg,#3FD9FF_0%,#12B5F2_55%,#0E8FD9_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(18,181,242,0.38),inset_0_1px_0_rgba(255,255,255,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(18,181,242,0.5),inset_0_1px_0_rgba(255,255,255,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#54E3FF]"
              >
                联系我
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </a>
            </div>

            {/* 中：渠道列表（configured 开关过滤；真实链接新窗口打开） */}
            <ul className="flex list-none flex-col justify-center gap-3">
              {site.contacts
                .filter((contact) => contact.configured)
                .map((contact) => {
                  const Icon = CHANNEL_ICONS[contact.label] ?? Network;
                  return (
                    <li key={contact.label} className="flex items-stretch">
                      {contact.href ? (
                        <a
                          href={contact.href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${contact.label}：${contact.value}（新窗口打开）`}
                          className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-glass-border bg-glass px-4 py-4 transition-colors duration-300 hover:bg-white/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#54E3FF]"
                        >
                          <ChannelBody
                            icon={<Icon className="size-[18px]" aria-hidden="true" />}
                            label={contact.label}
                            value={contact.value}
                            linked
                          />
                        </a>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-glass-border bg-glass px-4 py-4">
                          <ChannelBody
                            icon={<Icon className="size-[18px]" aria-hidden="true" />}
                            label={contact.label}
                            value={contact.value}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>

            {/* 右：英文短句 + 蝴蝶点缀 */}
            <aside className="relative overflow-hidden rounded-2xl border border-glass-border bg-glass p-5 text-center shadow-card lg:text-left">
              <span
                aria-hidden="true"
                className="absolute -bottom-8 -right-8 size-24 rounded-full bg-[#54E3FF]/20 blur-2xl"
              />
              {/* 纯视觉点缀（无相邻语义），撤下可访问名避免读屏凭空播报 */}
              <ButterflyLogo
                gradientId="contact-butterfly"
                className="absolute right-4 top-4 size-7"
                decorative
              />
              <p className="flex h-full items-center justify-center text-sm leading-relaxed text-text-primary lg:min-h-0 lg:justify-start lg:pr-10">
                Let&apos;s build something amazing together.
              </p>
            </aside>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}

/** 渠道条目本体：图标圆片 + 渠道名 + 值（真实链接带下划线与外跳箭头） */
function ChannelBody({
  icon,
  label,
  value,
  linked = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  linked?: boolean;
}) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-glass-border bg-glass-strong text-text-primary shadow-card">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {linked ? (
          <span className="mt-1 inline-flex items-center gap-0.5 text-sm font-medium text-text-primary underline decoration-text-primary/40 underline-offset-4 transition-colors group-hover:decoration-text-primary">
            {value}
            <ArrowUpRight
              className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </span>
        ) : (
          <span className="mt-1 inline-flex items-center text-sm text-text-primary">
            {value}
          </span>
        )}
      </div>
    </>
  );
}
