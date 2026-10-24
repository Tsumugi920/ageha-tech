import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * 精选项目（占位实现）：带 id="projects" 锚点的占位 section，
 * 项目卡片与封面素材将在后续迭代填充。
 */
export function FeaturedProjects() {
  return (
    <section
      id="projects"
      aria-label="精选项目"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 md:px-8"
    >
      <SectionHeading
        eyebrow="Featured Projects"
        title="精选项目"
        description="占位内容：精选项目卡片将在后续迭代中填充。"
        link={{ href: "#projects", label: "查看全部" }}
      />
      <GlassCard className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
          &lt;FeaturedProjects /&gt;
        </p>
        <p className="text-sm leading-relaxed text-text-secondary">
          版块占位 · 项目封面与介绍待填充
        </p>
      </GlassCard>
    </section>
  );
}
