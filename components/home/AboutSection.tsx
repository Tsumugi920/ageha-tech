import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * 关于我（占位实现）：带 id="about" 锚点的占位 section，
 * 个人介绍与照片素材将在后续迭代填充。
 */
export function AboutSection() {
  return (
    <section
      id="about"
      aria-label="关于我"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 md:px-8"
    >
      <SectionHeading
        eyebrow="About"
        title="关于我"
        description="占位内容：个人介绍将在后续迭代中填充。"
      />
      <GlassCard className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
          &lt;AboutSection /&gt;
        </p>
        <p className="text-sm leading-relaxed text-text-secondary">
          版块占位 · 个人介绍与照片待填充
        </p>
      </GlassCard>
    </section>
  );
}
