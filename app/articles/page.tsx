import type { Metadata } from "next";
import { ArrowRight, NotebookPen } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  plannedNoteLabel,
  plannedNotes,
  type NoteMotif,
} from "@/lib/notes";

export const metadata: Metadata = {
  title: "文章与实验",
  description:
    "Ageha.tech 的文章与实验：当前还没有已发布文章，这里展示正在构思的写作计划（技术笔记 / 产品思考 / 设计探索）。",
};

/**
 * 写作计划缩略图的概念视觉占位底色：与整页插画同源的冷蓝紫意象
 * （雪山湖光 / 悬浮城 / 极光山景的近似色阶）。纯装饰，文章发布后替换为真实封面。
 */
const MOTIF_GRADIENT: Record<NoteMotif, string> = {
  lake: "linear-gradient(180deg, #E3C8F7 0%, #9DB9F2 48%, #7FA3E6 68%, #5D86D6 100%)",
  city: "linear-gradient(180deg, #3D5192 0%, #22356A 55%, #141F49 100%)",
  aurora: "linear-gradient(180deg, #2A3B74 0%, #1A2A5C 55%, #0D1734 100%)",
};

function ConceptTile({ motif }: { motif: NoteMotif }) {
  return (
    <figure
      aria-hidden="true"
      className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-white/70 shadow-[0_6px_18px_rgba(71,115,183,0.18)] sm:size-24"
      style={{ background: MOTIF_GRADIENT[motif] }}
    >
      <span className="absolute left-2 top-2 size-1.5 rounded-full bg-white/85" />
      <figcaption className="absolute bottom-1 right-1 rounded-md bg-[#0B1B38]/55 px-1.5 py-px font-mono text-[8px] tracking-wider text-white/85">
        概念视觉
      </figcaption>
    </figure>
  );
}

/**
 * 文章与实验页：空状态 + 写作计划条目。
 *
 * 【诚实说明】当前没有已发布文章 —— 以下条目均为「写作计划」：
 * 每条都明确标注「写作计划中」，无日期、无阅读量、无链接（不可点击）；
 * 缩略图为概念视觉占位。文章真正发布后才会在这里出现真实入口。
 */
export default function ArticlesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-14 md:px-8">
      <GlassPanel className="relative overflow-hidden p-5 sm:p-7 lg:p-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-white/95 to-transparent"
        />

        <div className="relative">
          <PageHeader
            eyebrow="Articles"
            title="文章与实验"
            description="记录技术选择、设计探索、开发经验与那些值得继续探索的想法。"
            back={{ href: "/", label: "返回首页" }}
          />

          {/* 精致空状态：如实说明当前没有已发布文章 */}
          <p className="mt-8 flex items-center gap-2.5 rounded-2xl border border-line bg-white/45 px-4 py-3 text-xs leading-relaxed text-text-secondary">
            <NotebookPen
              className="size-4 shrink-0 text-blue"
              aria-hidden="true"
            />
            <span>
              当前还没有已发布文章 ——
              以下条目是正在构思的
              <strong className="font-semibold text-text-primary">
                写作计划
              </strong>
              ，配图为概念视觉占位；文章发布后，这里会以真实内容替换。
            </span>
          </p>

          {/* 写作计划条目：非链接卡片（无日期 / 无阅读量 / 无虚构入口） */}
          <ul className="relative mt-6 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plannedNotes.map((note) => (
              <li key={note.title}>
                <article className="glass-card relative h-full rounded-2xl p-4 pr-5">
                  <div className="flex gap-3.5">
                    <ConceptTile motif={note.motif} />
                    <div className="min-w-0 flex-1">
                      {/* 青色括号胶囊徽标（与首页文章版块同一部件样式） */}
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-[#35C8E8]/45 bg-white/55 px-2 py-0.5 text-[10px] font-medium leading-4 text-text-secondary">
                        <span
                          aria-hidden="true"
                          className="-ml-0.5 font-mono text-[11px] font-bold leading-none text-[#0E9FC6]"
                        >
                          (
                        </span>
                        {note.category}
                      </span>
                      <h2 className="mt-2 text-[13.5px] font-semibold leading-snug text-text-primary">
                        {note.title}
                      </h2>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                        {note.summary}
                      </p>
                      {/* 元信息行位置：以「写作计划中」替代日期与阅读量
                          （10px 小字用 text-secondary：text-muted 在玻璃底不达 4.5:1） */}
                      <span className="mt-2.5 inline-flex items-center gap-1 rounded-full border border-dashed border-line bg-white/45 px-2 py-0.5 text-[10px] leading-4 text-text-secondary">
                        <NotebookPen className="size-3" aria-hidden="true" />
                        {plannedNoteLabel}
                      </span>
                    </div>
                  </div>
                  {/* 右缘浅色小箭头：暗示未来文章入口，当前条目不可点击 */}
                  <ArrowRight
                    aria-hidden="true"
                    className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[#8FB4DC]/70"
                  />
                </article>
              </li>
            ))}
          </ul>
        </div>
      </GlassPanel>
    </div>
  );
}
