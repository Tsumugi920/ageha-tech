import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * 旅程 / 时间线（占位实现）：带 id="journey" 锚点的占位 section，
 * 成长时间线将在后续迭代填充。
 */
export function JourneySection() {
  return (
    <section
      id="journey"
      aria-label="我的旅程"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 md:px-8"
    >
      <SectionHeading
        eyebrow="Journey"
        title="我的旅程"
        description="占位内容：成长时间线将在后续迭代中填充。"
      />
      <GlassCard className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
          &lt;JourneySection /&gt;
        </p>
        <p className="text-sm leading-relaxed text-text-secondary">
          版块占位 · 时间线内容待填充
        </p>
      </GlassCard>
    </section>
  );
}
