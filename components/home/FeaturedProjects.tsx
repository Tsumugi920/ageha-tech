import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { projects } from "@/lib/projects";

/** 右上两行小注记（与参考图一致，定位为「正在构建 / 打磨」，非成果宣言） */
const SECTION_NOTE = [
  "一些正在构建、持续打磨，",
  "或记录我技术探索过程的作品。",
] as const;

/**
 * 精选项目版块：整段置于一张超宽白色玻璃大板上，
 * 头部行（左 eyebrow + 标题 + View All，右两行右对齐注记）+ 三等列卡片网格。
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
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 md:px-8"
    >
      <GlassPanel className="relative overflow-hidden p-5 sm:p-7 lg:p-9">
        {/* 面板顶部弧形高光：细高光线 + 一抹淡淡天光，像浮起的冰面 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-white/95 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 h-28 w-[72%] -translate-x-1/2 rounded-[100%] bg-linear-to-b from-white/70 to-transparent blur-lg"
        />

        {/* 头部行：左 eyebrow + 标题 + View All；右两行右对齐注记 */}
        <header className="relative mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
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

        {/* 三等列卡片网格（间距 24px；移动端单列纵排）——卡片本体为共享 ProjectCard */}
        <ul className="relative grid list-none gap-6 md:grid-cols-3">
          {projects.map((project, index) => (
            <li key={project.slug}>
              <ProjectCard project={project} index={index + 1} />
            </li>
          ))}
        </ul>
      </GlassPanel>
    </section>
  );
}
