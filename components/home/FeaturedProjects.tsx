import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { projects } from "@/lib/projects";

/** 右上两行小注记（与参考图一致，定位为「正在构建 / 打磨」，非成果宣言） */
const SECTION_NOTE = [
  "一些正在构建、持续打磨，",
  "或记录我技术探索过程的作品。",
] as const;

/**
 * 精选项目版块：直接坐在统一 .site-container 全宽内容网格上——
 * 头部行（左 eyebrow + 标题 + View All，右两行右对齐注记）+ 三等列卡片网格。
 * 不再把整段包进超宽玻璃大板逐级收窄（大板内边距 + 三等列会把每卡压到 ≈320px），
 * 玻璃底只留给卡片自身（共享 ProjectCard 的 glass-card）。
 *
 * 【诚实边界】卡片封面为参考图裁切的概念视觉占位：
 * 图内左上以「概念视觉占位」小徽标如实标注，alt 同样如实描述；
 * 卡片链接指向 /projects/<slug> 详情页，绝不虚构演示或源码链接。
 * 卡片本体抽取为 components/projects/ProjectCard.tsx，与 /projects 列表页共用。
 */
export function FeaturedProjects() {
  return (
    <section
      id="projects"
      aria-label="精选项目"
      className="site-container scroll-mt-24 py-20"
    >
      {/* 头部行：左 eyebrow + 标题 + View All；右两行右对齐注记 */}
      <header className="mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge>Featured Projects</Badge>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
              精选项目
            </h2>
            <Link
              href="/projects"
              className="tap-44 group inline-flex items-center gap-1.5 text-sm font-semibold text-link transition-colors hover:text-link-hover"
            >
              View All
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
        <p className="max-w-xs text-center text-xs leading-[1.9] text-text-secondary lg:max-w-none lg:text-right">
          <span className="flex items-center justify-center gap-2.5 lg:justify-end">
            <span
              aria-hidden="true"
              className="h-px w-9 shrink-0 bg-text-secondary/45"
            />
            {SECTION_NOTE[0]}
          </span>
          {SECTION_NOTE[1]}
        </p>
      </header>

      {/* 项目卡网格（移动端单列纵排）——卡片本体为共享 ProjectCard。
          md 起两列、xl 恢复三等列：1024 档三列会把每卡压到 ≈300px，
          描述触发截断、标签大量换行（第一轮视觉验收 1024x768）；
          两列给卡片 ≈450px 呼吸空间。≥1280 容器 1360→1840 阶梯放宽，
          三等列卡宽 410→565px，间距 md 起 32px 保持卡片不无限拉伸。
          显式 grid-cols-1（minmax(0,1fr)）：移动单列若用隐式 auto 轨道，
          会被卡内不可换行的标签行 min-content 撑到 ≈512px 造成横向溢出 */}
      <ul className="grid list-none grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
        {projects.map((project, index) => (
          <li key={project.slug}>
            <ProjectCard project={project} index={index + 1} />
          </li>
        ))}
      </ul>
    </section>
  );
}
