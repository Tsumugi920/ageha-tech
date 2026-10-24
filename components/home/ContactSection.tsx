import type { LucideIcon } from "lucide-react";
import { ArrowRight, Cat, Mail, Network } from "lucide-react";
import { ButterflyLogo } from "@/components/layout/ButterflyLogo";

/**
 * 联系渠道：【诚实占位】三项全部「待配置」且非链接 ——
 * 在站长提供真实账号前，绝不虚构任何邮箱或社交账号
 * （参考图中的示意账号与示意邮箱均不得照抄）。
 */
const CONTACT_CHANNELS: { label: string; icon: LucideIcon }[] = [
  { label: "GitHub", icon: Cat },
  { label: "邮箱", icon: Mail },
  { label: "其他平台", icon: Network },
];

/** 星空：静态点缀（装饰性，aria-hidden 由外层承担） */
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

/** 夜景底色：黄昏入夜 → 深海军蓝 → 底部渐回天光衔接页脚 */
const NIGHT_BG = [
  "radial-gradient(52rem 20rem at 82% 36%, rgba(156,131,255,0.3), transparent 68%)",
  "radial-gradient(44rem 16rem at 66% 60%, rgba(84,227,255,0.13), transparent 70%)",
  "radial-gradient(40rem 15rem at 10% 76%, rgba(84,227,255,0.12), transparent 72%)",
  "radial-gradient(30rem 12rem at 40% 26%, rgba(38,157,255,0.12), transparent 70%)",
  "linear-gradient(180deg, #DDEBFB 0%, #9FBFE8 4%, #3F669D 12%, #1E3762 26%, #152A50 45%, #101F40 68%, #17294B 80%, #6E92C4 92%, #E3EFFB 100%)",
].join(", ");

/**
 * 联系我：整段横卧在深海军蓝夜景底上 ——
 * 左文字块（eyebrow + 白色大标题 + 段落 + 青色渐变胶囊按钮 → /contact）
 * + 中深色玻璃渠道板（三渠道横排细竖线分隔，全部「待配置」非链接）
 * + 右深色玻璃小卡（英文短句 + 蝴蝶点缀）。
 */
export function ContactSection() {
  return (
    <section
      id="contact"
      aria-label="联系我"
      className="relative isolate scroll-mt-24 overflow-hidden"
    >
      {/* 夜景底：深海军蓝 + 紫色光河流 + 星光（装饰层） */}
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: NIGHT_BG }} />
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
        <path
          d="M0 200 V120 L120 84 L260 118 L420 78 L580 116 L760 82 L920 118 L1080 92 L1200 112 V200 Z"
          fill="#1A2E55"
          opacity="0.8"
        />
        <path
          d="M0 200 V150 L160 122 L320 152 L500 118 L680 150 L860 124 L1040 152 L1200 132 V200 Z"
          fill="#0A1730"
          opacity="0.9"
        />
      </svg>

      <div className="mx-auto w-full max-w-6xl px-4 py-20 md:px-8 lg:py-24">
        <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,2.25fr)_minmax(0,1.25fr)]">
          {/* 左：文字块 */}
          <div className="flex flex-col items-start justify-center gap-4 lg:pr-2">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.32em] text-[#8FE9FF]">
              Contact
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              有一个想法？
            </h2>
            <p className="max-w-md text-sm leading-loose text-[#C6DAF6] md:text-[15px]">
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

          {/* 中：深色玻璃渠道板（三渠道横排，细竖线分隔；全部非链接） */}
          <ul className="grid grid-cols-1 divide-y divide-white/10 rounded-2xl border border-white/15 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_46px_rgba(3,10,28,0.45)] backdrop-blur-xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {CONTACT_CHANNELS.map((channel) => {
              const Icon = channel.icon;
              return (
                <li
                  key={channel.label}
                  className="flex items-center gap-2.5 px-4 py-5"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold whitespace-nowrap text-white">
                      {channel.label}
                    </p>
                    <span className="mt-1 inline-flex items-center whitespace-nowrap rounded-full border border-dashed border-white/30 px-1.5 py-px text-[10px] leading-4 text-white/70">
                      待配置
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* 右：英文短句 + 蝴蝶点缀 */}
          <aside className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_46px_rgba(3,10,28,0.45)] backdrop-blur-xl lg:text-left">
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
            <p className="flex h-full min-h-24 items-center justify-center text-sm leading-relaxed text-white/85 lg:min-h-0 lg:justify-start lg:pr-10">
              Let&apos;s build something amazing together.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
