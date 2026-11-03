import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";
import type { JourneyStage } from "@/lib/content-types";

/**
 * 时间线三阶段（与真实经历定位一致的概括表述）。
 *
 * 【诚实边界】参考图中的「年份区间」没有依据，一律不出现任何年份；
 * 阶段描述采用过程性概括，具体经历待站长核对后补充。
 */
const STAGES: readonly JourneyStage[] = [
  { title: "探索", description: "学习 Web 前端与小工具构建" },
  { title: "进阶", description: "原生前端 + Node.js + Express + data.json 的套路" },
  { title: "总结", description: "沉淀方法，持续打磨作品" },
];

type JourneyCardProps = {
  /** 卡片内是否重复展示 MY JOURNEY 面板标题（独立形态由版块标题承担） */
  heading?: boolean;
  /** 折线装饰渐变 id：双形态会在 DOM 中同时存在，id 必须互不重复 */
  gradientId: string;
  className?: string;
};

/**
 * MY JOURNEY 白色小玻璃卡：竖向时间线（贯穿细线 + 菱形内芯圆节点）
 * + 底部青色山脉折线装饰收尾（右端渐隐，呼应数据感）。
 *
 * 阶段标题级别随形态切换，避免标题跳级：
 * - 嵌套形态卡内自带 h3「My Journey」→ 阶段用 h4；
 * - 独立形态版块标题（SectionHeading）为 h2、卡内无中间层级 → 阶段用 h3。
 */
function JourneyCard({ heading = false, gradientId, className }: JourneyCardProps) {
  const StageTag = heading ? "h4" : "h3";
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-glass-border bg-glass-strong p-5 shadow-card backdrop-blur-md sm:p-6",
        className,
      )}
    >
      {heading ? (
        <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.24em] text-text-primary">
          My Journey
        </h3>
      ) : null}

      <ol className="relative mt-5 flex-1 list-none space-y-7">
        {/* 贯穿细线：青色渐变，右下自然淡出 */}
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 left-[11px] w-px bg-linear-to-b from-[#1CC0FE]/70 via-[#1CC0FE]/40 to-[#1CC0FE]/0"
        />
        {STAGES.map((stage, index) => (
          <li key={stage.title} className="relative flex gap-4">
            {/* 节点：白底青描边圆 + 青色菱形内芯；首节点高亮外扩 */}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center self-start rounded-full border bg-white",
                index === 0
                  ? "border-[#1CC0FE] shadow-[0_0_0_4px_rgba(28,192,254,0.16),0_0_16px_rgba(28,192,254,0.35)]"
                  : "border-[#1CC0FE]/60",
              )}
            >
              <span className="size-1.5 rotate-45 rounded-[1px] bg-[#1CC0FE]" />
            </span>
            <div className="min-w-0">
              <StageTag className="text-[15px] font-bold leading-snug text-text-primary">
                {stage.title}
              </StageTag>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                {stage.description}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* 底部山脉折线装饰：细青色 stroke，右端渐隐 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 220 44"
        fill="none"
        className="mt-7 w-full"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="22"
            x2="220"
            y2="22"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#1CC0FE" />
            <stop offset="0.72" stopColor="#1CC0FE" stopOpacity="0.5" />
            <stop offset="1" stopColor="#1CC0FE" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M2 32 L18 20 L30 27 L44 12 L58 26 L72 21 L86 31 L102 17 L116 27 L132 13 L148 24 L164 19 L180 29 L198 21 L218 27"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

type JourneySectionProps = {
  /**
   * 嵌套形态（桌面端专用）：由 AboutSection 渲染在通栏玻璃板最右一列，
   * 只渲染小白玻璃卡本体，不带锚点 id 与版块标题。
   */
  nested?: boolean;
};

/**
 * 探索与成长版块（MY JOURNEY）。
 *
 * 双形态布局（page.tsx 固定先渲染 AboutSection 再渲染本组件）：
 * - 桌面（lg+）：由 AboutSection 以 `<JourneySection nested />` 嵌进大板最右列，
 *   本组件自身隐藏（lg:hidden），每端恰好只渲染一份时间线，锚点 id 唯一；
 * - 移动 / 平板：脱离 About 独立成块，时间线纵占全宽、节点行左对齐。
 */
export function JourneySection({ nested = false }: JourneySectionProps) {
  if (nested) {
    return (
      <div className="hidden lg:block">
        <JourneyCard heading gradientId="journey-ridge-nested" className="h-full" />
      </div>
    );
  }

  return (
    <section
      id="journey"
      aria-label="探索与成长"
      className="site-container scroll-mt-24 py-16 lg:hidden"
    >
      <SectionHeading eyebrow="My Journey" title="探索与成长" />
      <JourneyCard gradientId="journey-ridge-standalone" />
    </section>
  );
}
