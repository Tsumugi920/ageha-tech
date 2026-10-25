import { ArrowRight, NotebookPen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  plannedNoteLabel,
  plannedNotes,
  type NoteMotif,
} from "@/lib/notes";

/**
 * 概念视觉占位缩略图：与整页插画同源的冷蓝紫 SVG 小景（雪山湖光 / 悬浮城 / 极光山景），
 * 以 5:2 横幅铺在卡顶（slice 裁切保留场景主体带）。纯装饰（aria-hidden），
 * 右下角带「概念视觉」小注，文章发布后替换为真实封面。
 */
function ConceptThumb({ motif }: { motif: NoteMotif }) {
  return (
    <figure
      aria-hidden="true"
      className="relative aspect-[5/2] w-full overflow-hidden rounded-xl border border-glass-border shadow-[0_6px_18px_rgba(71,115,183,0.18)]"
    >
      <svg
        viewBox="0 0 96 96"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {motif === "lake" ? <LakeScene /> : motif === "city" ? <CityScene /> : <AuroraScene />}
      </svg>
      <figcaption className="absolute bottom-1.5 right-1.5 rounded-md bg-[#0B1B38]/55 px-1.5 py-px font-mono text-[8px] tracking-wider text-white/85">
        概念视觉
      </figcaption>
    </figure>
  );
}

/** 雪山湖光：粉紫天空 + 雪顶山 + 湖面波光 */
function LakeScene() {
  return (
    <>
      <defs>
        <linearGradient
          id="notes-lake-sky"
          x1="0"
          y1="0"
          x2="0"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#E3C8F7" />
          <stop offset="0.55" stopColor="#9DB9F2" />
          <stop offset="1" stopColor="#7FA3E6" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" fill="url(#notes-lake-sky)" />
      <circle cx="70" cy="22" r="7" fill="#FDF6FF" opacity="0.85" />
      <path d="M0 58 L22 34 L38 52 L52 40 L70 58 Z" fill="#8FA6D9" />
      <path d="M26 58 L52 26 L78 58 Z" fill="#5F7CC4" />
      <path d="M52 26 L61 37 L57 35 L52 40 L46 34 L43 37 Z" fill="#F4F8FF" />
      <rect y="58" width="96" height="38" fill="#5D86D6" />
      <path
        d="M30 66 H74"
        stroke="#A9C6F2"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M38 74 H66"
        stroke="#A9C6F2"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M34 82 H58"
        stroke="#A9C6F2"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
    </>
  );
}

/** 悬浮城：深蓝夜空 + 悬浮平台塔楼 + 青紫窗灯 */
function CityScene() {
  return (
    <>
      <defs>
        <linearGradient
          id="notes-city-sky"
          x1="0"
          y1="0"
          x2="0"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#3D5192" />
          <stop offset="1" stopColor="#141F49" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" fill="url(#notes-city-sky)" />
      <circle cx="16" cy="14" r="1" fill="#FFFFFF" opacity="0.8" />
      <circle cx="80" cy="20" r="0.8" fill="#FFFFFF" opacity="0.7" />
      <circle cx="64" cy="9" r="0.7" fill="#FFFFFF" opacity="0.6" />
      <circle cx="30" cy="24" r="0.6" fill="#FFFFFF" opacity="0.5" />
      <path d="M48 44 L74 52 L48 60 L22 52 Z" fill="#26386F" />
      <rect x="34" y="28" width="8" height="20" fill="#1B2B58" />
      <rect x="46" y="20" width="9" height="28" fill="#22356A" />
      <rect x="59" y="32" width="7" height="16" fill="#1B2B58" />
      <path
        d="M50.5 20 V12"
        stroke="#54E3FF"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="50.5" cy="11" r="1.6" fill="#54E3FF" />
      <rect x="47.5" y="26" width="2" height="2" fill="#54E3FF" opacity="0.9" />
      <rect x="51" y="32" width="2" height="2" fill="#9C83FF" opacity="0.8" />
      <rect x="36" y="33" width="2" height="2" fill="#54E3FF" opacity="0.7" />
      <rect x="61" y="37" width="1.6" height="1.6" fill="#54E3FF" opacity="0.7" />
      <path d="M30 68 L36 66 L38 70 L32 72 Z" fill="#22356A" />
      <path d="M58 74 L63 72.5 L64.5 76 L59.5 77.5 Z" fill="#1B2B58" />
      <ellipse cx="48" cy="62" rx="20" ry="3.5" fill="#54E3FF" opacity="0.18" />
    </>
  );
}

/** 极光山景：靛蓝夜空 + 青紫极光飘带 + 山脊剪影 */
function AuroraScene() {
  return (
    <>
      <defs>
        <linearGradient
          id="notes-aurora-sky"
          x1="0"
          y1="0"
          x2="0"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2A3B74" />
          <stop offset="1" stopColor="#0D1734" />
        </linearGradient>
        <filter id="notes-aurora-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <rect width="96" height="96" fill="url(#notes-aurora-sky)" />
      <circle cx="20" cy="14" r="0.9" fill="#FFFFFF" opacity="0.8" />
      <circle cx="46" cy="9" r="0.7" fill="#FFFFFF" opacity="0.6" />
      <circle cx="78" cy="26" r="0.8" fill="#FFFFFF" opacity="0.7" />
      <path
        d="M6 44 C 26 18, 44 34, 62 14 C 72 4, 84 10, 92 6"
        stroke="#54E3FF"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
        filter="url(#notes-aurora-blur)"
      />
      <path
        d="M4 56 C 24 34, 46 46, 66 26 C 78 15, 86 20, 93 16"
        stroke="#9C83FF"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
        filter="url(#notes-aurora-blur)"
      />
      <path
        d="M10 36 C 28 22, 48 28, 88 12"
        stroke="#B7F0FF"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
        filter="url(#notes-aurora-blur)"
      />
      <path
        d="M0 96 V70 L18 56 L34 68 L52 52 L70 66 L84 58 L96 68 V96 Z"
        fill="#0A142E"
      />
      <path d="M18 56 L34 68 L28 68 L20 61 Z" fill="#24365F" opacity="0.9" />
    </>
  );
}

/**
 * 文章与实验：左侧独立头部块（eyebrow + 标题 + 副题 + View All）
 * + 右侧三条竖向写作计划卡（缩略图 → 分类 → 标题 → 摘要 → 状态），
 * 视觉与项目卡片同语言但密度更轻。
 *
 * 【诚实说明】当前没有已发布文章：三张卡均为「写作计划」条目
 * —— 带虚线「写作计划中」徽标，无日期、无阅读量、无链接，
 * 缩略图为概念视觉占位；顶部另设一条空状态说明。
 */
export function LatestNotes() {
  return (
    <section
      id="notes"
      aria-label="文章与实验"
      className="site-container scroll-mt-24 py-16"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        {/* 左侧独立头部块 */}
        <header className="space-y-3">
          <Badge>Latest Notes</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            文章与实验
          </h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            记录技术选择、设计探索、开发经验与那些值得继续探索的想法。
          </p>
          <a
            href="#notes"
            className="tap-44 group inline-flex items-center gap-1.5 text-sm font-semibold text-link transition-colors hover:text-link-hover"
          >
            View All
            <ArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </header>

        <div className="min-w-0 space-y-4">
          {/* 精致空状态：说明当前无已发布文章 */}
          <p className="glass-panel flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs leading-relaxed text-text-secondary">
            <NotebookPen
              className="size-4 shrink-0 text-blue"
              aria-hidden="true"
            />
            <span>
              当前还没有已发布文章 ——
              以下三条是正在构思的
              <strong className="font-semibold text-text-primary">
                写作计划
              </strong>
              ，卡内配图为概念视觉占位；文章发布后，这里会以真实内容替换。
            </span>
          </p>

          {/* 三条写作计划卡：竖向三列（与项目卡片同视觉语言、密度更轻）——
              缩略图 → 分类 → 标题 → 摘要 → 状态（不可点击，无日期 / 无阅读量） */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plannedNotes.map((note) => (
              <article
                key={note.title}
                className="glass-card relative flex h-full flex-col rounded-2xl p-5"
              >
                <ConceptThumb motif={note.motif} />
                {/* 青色括号胶囊徽标（本区特色部件） */}
                <span className="mt-3 inline-flex w-fit items-center gap-0.5 rounded-full border border-[#35C8E8]/45 bg-white/55 px-2 py-0.5 text-[10px] font-medium leading-4 text-text-secondary">
                  <span
                    aria-hidden="true"
                    className="-ml-0.5 font-mono text-[11px] font-bold leading-none text-[#0E9FC6]"
                  >
                    (
                  </span>
                  {note.category}
                </span>
                <h3 className="mt-2 text-sm font-semibold leading-snug text-text-primary">
                  {note.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                  {note.summary}
                </p>
                {/* 状态行置底：以「写作计划中」替代日期与阅读量
                    （10px 小字用 text-secondary：text-muted 在玻璃底不达 4.5:1） */}
                <div className="mt-auto pt-3">
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line bg-white/45 px-2 py-0.5 text-[10px] leading-4 text-text-secondary">
                    <NotebookPen className="size-3" aria-hidden="true" />
                    {plannedNoteLabel}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
