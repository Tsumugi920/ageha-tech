import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Project } from "@/lib/content-types";

export type ProjectCardProps = {
  /** 项目数据（来自 lib/projects.ts，仅渲染其中真实存在的字段） */
  project: Project;
  /** 右上角编号角标（从 1 开始；不传则不渲染角标） */
  index?: number;
  /**
   * 首屏 LCP 大图才需要 priority（如项目详情页封面）；
   * 列表 / 网格卡片默认懒加载，不要随意开启。
   */
  priority?: boolean;
  /** 响应式尺寸提示，与父级网格列宽对应 */
  sizes?: string;
  /**
   * 卡片标题的标题级别：默认 h3（首页「精选项目」section 内已有 h2，
   * h2→h3 正确嵌套）；/projects 列表页 h1 下没有中间层级，传 "h2" 避免跳级。
   */
  headingLevel?: "h2" | "h3";
};

/** 默认 sizes：三等列网格（首页精选与项目列表页共用同版式） */
const DEFAULT_SIZES = "(min-width: 768px) 33vw, 100vw";

/**
 * 项目卡（首页「精选项目」与 /projects 列表页共用的唯一实现，保证视觉一致）。
 *
 * 【诚实边界】封面徽标按 coverKind 如实渲染：concept 挂「概念视觉占位」，
 * real（项目真实界面截图）不挂任何徽标；alt 同样如实描述。
 * 卡片只展示 lib/projects.ts 里真实存在的字段（名称 / 类别 / 描述 / 标签），
 * 唯一入口为右上圆形箭头 → /projects/<slug> 详情页（真实上线/源码入口在详情页）。
 */
export function ProjectCard({
  project,
  index,
  priority = false,
  sizes = DEFAULT_SIZES,
  headingLevel = "h3",
}: ProjectCardProps) {
  const TitleTag = headingLevel;
  return (
    <GlassCard className="group flex h-full flex-col p-4 sm:p-5">
      {/* 封面：统一比例，左上徽标（仅概念占位）+ 右上编号角标 */}
      <div className="relative aspect-[2/1] overflow-hidden rounded-xl border border-white/70">
        <Image
          src={project.cover}
          alt={project.coverAlt}
          fill
          sizes={sizes}
          priority={priority}
          style={project.coverPosition ? { objectPosition: project.coverPosition } : undefined}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        {project.coverKind === "concept" && (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-white/70 bg-white/75 px-2.5 py-0.5 text-[10px] font-medium text-text-secondary backdrop-blur-sm">
            概念视觉占位
          </span>
        )}
        {index !== undefined && (
          <span
            aria-hidden="true"
            className="absolute right-2.5 top-2.5 rounded-md bg-white/85 px-2 py-0.5 font-mono text-xs font-semibold text-text-primary backdrop-blur-sm"
          >
            {String(index).padStart(2, "0")}
          </span>
        )}
      </div>

      <TitleTag className="mt-4 font-display text-lg font-bold tracking-tight text-text-primary">
        {project.name}
      </TitleTag>
      <p className="mt-0.5 text-[13px] text-text-secondary">{project.category}</p>
      <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-text-secondary">
        {project.description}
      </p>

      {/* 底部：标签行 + 右下圆形箭头（移动端标签可横向滚动） */}
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <ul
          aria-label={`${project.name} 技术标签`}
          className="flex list-none gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] md:flex-wrap [&::-webkit-scrollbar]:hidden"
        >
          {project.tags.map((tag) => (
            <li
              key={tag}
              className="shrink-0 whitespace-nowrap rounded-full border border-white/60 bg-[#C8D7EB]/40 px-3 py-1 text-xs font-medium text-text-primary"
            >
              {tag}
            </li>
          ))}
        </ul>
        <a
          href={`/projects/${project.slug}`}
          aria-label={`查看项目：${project.name}`}
          className="group/arrow inline-grid size-11 shrink-0 place-items-center rounded-full bg-linear-to-br from-cyan to-blue shadow-[0_8px_20px_rgba(38,157,255,0.30)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <span className="grid size-[calc(100%-2px)] place-items-center rounded-full bg-white/95">
            <ArrowRight
              className="size-4 text-text-primary transition-transform duration-300 group-hover/arrow:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </a>
      </div>
    </GlassCard>
  );
}
