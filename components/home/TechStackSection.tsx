import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * 技术栈（占位实现）：带 id="tech" 锚点的占位 section，
 * 技能矩阵将在后续迭代填充。
 */
export function TechStackSection() {
  return (
    <section
      id="tech"
      aria-label="技术栈"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 md:px-8"
    >
      <SectionHeading
        eyebrow="Tech Stack"
        title="技术栈"
        description="占位内容：技能矩阵将在后续迭代中填充。"
      />
      <GlassCard className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
          &lt;TechStackSection /&gt;
        </p>
        <p className="text-sm leading-relaxed text-text-secondary">
          版块占位 · 技能标签与分组待填充
        </p>
      </GlassCard>
    </section>
  );
}
