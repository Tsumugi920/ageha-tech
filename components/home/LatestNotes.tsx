import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * 最新文章（占位实现）：带 id="notes" 锚点的占位 section，
 * 文章列表将在后续迭代填充（不虚构任何文章与阅读量）。
 */
export function LatestNotes() {
  return (
    <section
      id="notes"
      aria-label="最新文章"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 md:px-8"
    >
      <SectionHeading
        eyebrow="Latest Notes"
        title="最新文章"
        description="占位内容：文章列表将在写作计划落地后填充。"
        link={{ href: "#notes", label: "全部文章" }}
      />
      <GlassCard className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
          &lt;LatestNotes /&gt;
        </p>
        <p className="text-sm leading-relaxed text-text-secondary">
          版块占位 · 文章列表待填充
        </p>
      </GlassCard>
    </section>
  );
}
