import Image from "next/image";
import { ArrowRight, Glasses, MapPin, Terminal } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { Badge } from "@/components/ui/Badge";
import { JourneySection } from "@/components/home/JourneySection";
import type { AboutFact } from "@/lib/content-types";

/**
 * 「关于我」三组条目（图标 + 标题 + 一行说明）。
 * 图标对应参考图：终端（开发者）、心形护目镜（兴趣方向）、地图标签（个人理念）。
 */
const FACTS: readonly AboutFact[] = [
  {
    title: "开发者",
    description: "做小而可用的网页工具和实验项目：原生前端 + Node.js + Express + data.json，或纯静态 localStorage，不用数据库。",
    icon: Terminal,
  },
  {
    title: "兴趣方向",
    description: "网页小工具 / 数据档案 / 交互实验",
    icon: Glasses,
  },
  {
    title: "个人理念",
    description: "保持好奇，持续做小而可用的东西。",
    icon: MapPin,
  },
];

/**
 * 关于我版块：直接坐在统一 .site-container 上（不再整段包进一块巨型玻璃板），
 * 桌面三栏 lg:grid-cols-[0.9fr_1.2fr_1fr]——
 * 左：介绍文字（Badge + 标题 + 三句文案 + 了解更多），宽度足够阅读；
 * 中：个人视觉图（about-photo.png 为 2:1 横幅插画，按原生比例出框，
 *     修掉旧版窄列 min-h/flex 拉伸造成的无意义强裁切）；
 * 右：个人方向三张浅玻璃小卡（图标 + 标题 + 一行说明，各自独立不并入大板）
 *     + My Journey 时间线（独立白玻璃卡，竖向空间充裕；无真实年份，
 *     仅「探索 / 进阶 / 总结」过程性阶段）。
 * 移动 / 平板：单列纵排（文字→照片→方向三卡），journey 脱离本区独立成块。
 *
 * 【诚实边界】照片为参考图裁切的二次元概念插画（非真实照片），
 * 以「概念插画 · 非真实照片」小徽标如实标注，alt 同样如实描述。
 */
export function AboutSection() {
  return (
    <section
      id="about"
      aria-label="关于我"
      className="site-container scroll-mt-24 py-20"
    >
      <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[0.9fr_1.2fr_1fr] lg:gap-8">
        {/* 左：介绍文字 */}
        <div className="flex flex-col items-start">
          <Badge>About Me</Badge>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            关于我
          </h2>
          <div className="mt-4 space-y-2 text-sm leading-[1.95] text-text-secondary">
            <p>我做小而可用的网页工具和实验项目。</p>
            <p>套路固定：原生前端 + Node.js + Express + data.json，或者纯静态 localStorage，不用数据库。</p>
            <p>
              希望
              {/* 渐变字用加深档蓝紫对：品牌蓝 #269DFF 起始端在玻璃底仅 2.66:1（14px 需 4.5:1） */}
              <span className="bg-linear-to-r from-link to-link-hover bg-clip-text font-semibold text-transparent">
                自己
              </span>
              的努力，把一些有趣的想法变成现实。
            </p>
          </div>
          {/* mt-auto 置底：左栏底边与中栏插画底边对齐，
              消除左列内容偏短造成的底部参差空白（移动单列下 mt-auto 无效果，
              wrapper 的 pt-7 保证任意形态下按钮与文案的最小间距） */}
          <div className="mt-auto pt-7">
            <GlassButton
              variant="ghost"
              href="/about"
              className="border-link/40 text-link hover:text-link"
            >
              了解更多
              <ArrowRight className="size-4" aria-hidden="true" />
            </GlassButton>
          </div>
        </div>

        {/* 中：个人视觉图（原生 2:1 比例出框，不做无意义裁切；
            self-start 防止栅格行拉伸把图框拉成竖长空白） */}
        <figure className="relative m-0 self-start overflow-hidden rounded-2xl border border-glass-border shadow-card">
          <div className="relative aspect-[2/1] w-full">
            <Image
              src="/images/about-photo.png"
              alt="关于我概念插画：创作者坐在窗前，眺望紫粉色调的未来都市天际线（概念视觉占位，非真实照片）"
              fill
              sizes="(min-width: 1024px) 38vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <figcaption className="absolute bottom-2 right-2 rounded-full border border-white/70 bg-white/75 px-2.5 py-0.5 text-[10px] font-medium text-text-secondary backdrop-blur-sm">
            概念插画 · 非真实照片
          </figcaption>
        </figure>

        {/* 右：个人方向小卡 + My Journey 时间线（各自独立卡片） */}
        <div className="flex flex-col gap-5 md:col-span-2 lg:col-span-1">
          <ul className="grid list-none gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {FACTS.map((fact) => (
              <li
                key={fact.title}
                className="flex items-start gap-3.5 rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-sm"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-glass-border bg-glass-strong shadow-card">
                  <fact.icon className="size-5 text-blue" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-text-primary">
                    {fact.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                    {fact.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <JourneySection nested />
        </div>
      </div>
    </section>
  );
}
