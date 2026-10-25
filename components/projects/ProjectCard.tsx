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
 * 结构自上而下：封面（3/2，卡片最主要视觉区域）→ 类别与序号元信息行
 * → 项目名称 → 简短完整介绍（文案控制在 3 行内，line-clamp-3 仅作节奏兜底）
 * → 技术标签 → 「查看详情」胶囊入口。
 * 视觉：浅色玻璃面板 + 细蓝边框 + 柔和投影；hover 仅轻微上移（glass-card 基类
 * -4px）、封面图 1.04 缩放与边框加深（边缘高光），不叠加发光阴影。
 *
 * 【诚实边界】封面徽标按 coverKind 如实渲染：concept 挂「概念视觉占位」，
 * real（项目真实界面截图）不挂任何徽标；alt 同样如实描述。
 * 卡片只展示 lib/projects.ts 里真实存在的字段（名称 / 类别 / 描述 / 标签），
 * 唯一入口为「查看详情」→ /projects/<slug> 详情页
 * （真实上线/源码入口在详情页，卡片不虚构演示或源码链接）。
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
    <GlassCard className="group flex h-full flex-col border-[#9EC4EC] p-5 transition-[transform,box-shadow,border-color] duration-300 hover:border-[#7FB2E6] sm:p-6 xl:p-7">
      {/* 封面：统一比例（3/2，容器加宽后图面更大），左上徽标（仅概念占位） */}
      <div className="relative aspect-[3/2] overflow-hidden rounded-xl border border-glass-border">
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
      </div>

      {/* 类别与序号：封面之下、名称之上的元信息行 */}
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-text-secondary">{project.category}</p>
        {index !== undefined && (
          <span
            aria-hidden="true"
            className="shrink-0 font-mono text-xs font-semibold text-text-secondary"
          >
            {String(index).padStart(2, "0")}
          </span>
        )}
      </div>

      <TitleTag className="mt-1.5 font-display text-xl font-bold tracking-tight text-text-primary md:text-2xl">
        {project.name}
      </TitleTag>
      <p className="mt-2.5 line-clamp-4 text-sm leading-relaxed text-text-secondary md:text-[15px]">
        {project.description}
      </p>

      {/* 底部：技术标签行 + 「查看详情」胶囊入口（移动端标签可横向滚动） */}
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <ul
          aria-label={`${project.name} 技术标签`}
          className="flex list-none gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] md:flex-wrap [&::-webkit-scrollbar]:hidden"
        >
          {project.tags.map((tag) => (
            <li
              key={tag}
              className="shrink-0 whitespace-nowrap rounded-full border border-white/60 bg-[#C8D7EB]/40 px-3 py-1 text-[13px] font-medium text-text-primary"
            >
              {tag}
            </li>
          ))}
        </ul>
        {/* 入口胶囊：py-1×2 + size-9 圆钮 = 44px 触控高度 */}
        <a
          href={`/projects/${project.slug}`}
          aria-label={`查看详情：${project.name}`}
          className="group/arrow inline-flex shrink-0 items-center gap-2 rounded-full border border-white/70 bg-white/60 py-1 pl-3.5 pr-1 text-[13px] font-semibold text-link shadow-[0_4px_14px_rgba(71,115,183,0.12)] transition-colors duration-300 hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          查看详情
          <span className="grid size-9 place-items-center rounded-full bg-linear-to-br from-cyan to-blue shadow-[0_4px_12px_rgba(38,157,255,0.30)]">
            <span className="grid size-[calc(100%-2px)] place-items-center rounded-full bg-white/95">
              <ArrowRight
                className="size-4 text-text-primary transition-transform duration-300 group-hover/arrow:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </span>
        </a>
      </div>
    </GlassCard>
  );
}
