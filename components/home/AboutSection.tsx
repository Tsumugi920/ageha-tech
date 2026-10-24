import Image from "next/image";
import { ArrowRight, Glasses, MapPin, Terminal } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
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
    description: "专注 Web 应用开发，热衷于技术探索与实践。",
    icon: Terminal,
  },
  {
    title: "兴趣方向",
    description: "Web 系统 / AI 应用 / 交互设计 / 数字产品",
    icon: Glasses,
  },
  {
    title: "个人理念",
    description: "保持好奇，持续学习，用技术创造价值。",
    icon: MapPin,
  },
];

/**
 * 关于我版块：一整条通栏浅冰蓝玻璃大板，内部四区横排（桌面）——
 * 左文字区（eyebrow→标题→三行段落→按钮）、中插画照片卡（圆角玻璃框）、
 * 右三组条目小卡、最右 MY JOURNEY 嵌套子面板（桌面端由 JourneySection 提供）。
 * 移动端单列纵排：文字→照片→三条目；journey 脱离本板独立成块。
 *
 * 【诚实边界】照片为参考图裁切的二次元概念插画（非真实照片），
 * 以「概念插画 · 非真实照片」小徽标如实标注，alt 同样如实描述。
 */
export function AboutSection() {
  return (
    <section
      id="about"
      aria-label="关于我"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 md:px-8"
    >
      <GlassPanel className="p-6 sm:p-8 lg:p-9">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[26fr_30fr_26fr_18fr] lg:gap-7">
          {/* 左：文字区 */}
          <div className="flex flex-col items-start">
            <Badge>About Me</Badge>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
              关于我
            </h2>
            <div className="mt-4 space-y-2 text-sm leading-[1.95] text-text-secondary">
              <p>我热爱技术，专注于构建有意义的数字产品。</p>
              <p>喜欢探索前沿技术，也享受设计和创造的过程。</p>
              <p>
                希望
                {/* 渐变字用加深档蓝紫对：品牌蓝 #269DFF 起始端在玻璃底仅 2.66:1（14px 需 4.5:1） */}
                <span className="bg-linear-to-r from-link to-link-hover bg-clip-text font-semibold text-transparent">
                  自己
                </span>
                的努力，把一些有趣的想法变成现实。
              </p>
            </div>
            <GlassButton
              variant="ghost"
              href="/about"
              className="mt-7 border-link/40 text-link hover:text-link"
            >
              了解更多
              <ArrowRight className="size-4" aria-hidden="true" />
            </GlassButton>
          </div>

          {/* 中：插画照片卡（圆角玻璃框 + 概念插画标注） */}
          <figure className="m-0 flex overflow-hidden rounded-2xl border border-white/70 bg-white/45 p-1.5 shadow-[0_12px_40px_rgba(71,115,183,0.14)] backdrop-blur-sm">
            <div className="relative min-h-52 w-full flex-1 overflow-hidden rounded-xl">
              <Image
                src="/images/about-photo.png"
                alt="关于我概念插画：创作者坐在窗前，眺望紫粉色调的未来都市天际线（概念视觉占位，非真实照片）"
                fill
                sizes="(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              <figcaption className="absolute bottom-2 right-2 rounded-full border border-white/70 bg-white/75 px-2.5 py-0.5 text-[10px] font-medium text-text-secondary backdrop-blur-sm">
                概念插画 · 非真实照片
              </figcaption>
            </div>
          </figure>

          {/* 右：三组条目小卡（圆形玻璃图标 + 标题 + 一行说明） */}
          <ul className="flex list-none flex-col justify-center gap-3 md:col-span-2 lg:col-span-1">
            {FACTS.map((fact) => (
              <li
                key={fact.title}
                className="flex items-start gap-3.5 rounded-2xl border border-white/60 bg-white/40 p-3.5 backdrop-blur-sm"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/80 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_14px_rgba(38,157,255,0.14)]">
                  <fact.icon className="size-5 text-blue" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-text-primary">
                    {fact.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                    {fact.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* 最右：MY JOURNEY 嵌套子面板（仅桌面；移动端由独立版块承接） */}
          <JourneySection nested />
        </div>
      </GlassPanel>
    </section>
  );
}
