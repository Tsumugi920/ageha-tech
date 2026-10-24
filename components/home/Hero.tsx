import { GlassButton } from "@/components/ui/GlassButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Badge } from "@/components/ui/Badge";
import { site } from "@/lib/site";

/**
 * Hero 首屏（占位实现）：品牌身份 + 主标语 + 双行动按钮。
 * 概念视觉与 hero 视觉素材将在下一轮迭代填充。
 */
export function Hero() {
  return (
    <section id="home" aria-label="首屏" className="px-4 pt-20 md:px-8 md:pt-28">
      <GlassPanel className="mx-auto max-w-6xl px-6 py-16 text-center md:px-10 md:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <Badge>{site.identity}</Badge>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-text-primary md:text-6xl">
            {site.tagline}
          </h1>
          <p className="text-base leading-relaxed text-text-secondary md:text-lg">
            占位首屏：{site.brandLine} —— 概念视觉与主视觉素材将在后续迭代中填充。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <GlassButton href="#projects">查看项目</GlassButton>
            <GlassButton href="#contact" variant="ghost">
              联系我
            </GlassButton>
          </div>
        </div>
      </GlassPanel>
    </section>
  );
}
