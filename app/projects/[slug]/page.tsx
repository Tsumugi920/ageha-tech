import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { projects } from "@/lib/projects";

/**
 * 状态徽标：三个项目均为「正在构建 / 持续打磨 / 技术探索」中的作品，
 * 详情页只提供这一种如实状态，不出现任何成果宣言类表述。
 */
const STATUS_LABEL = "探索中";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

/** 静态生成：覆盖 lib/projects.ts 中的全部三个项目 */
export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

function findProject(slug: string) {
  return projects.find((project) => project.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = findProject(slug);
  if (!project) {
    return { title: "项目不存在" };
  }
  return {
    title: project.name,
    description: `${project.name}（${project.category}）—— ${project.description}`,
  };
}

/**
 * 项目详情页：封面（概念视觉占位，如实在图内标注）+ 类别 + 描述 + 技术标签
 * + 「探索中」状态徽标 + 返回列表链接。
 *
 * 【诚实边界】只渲染 lib/projects.ts 里真实存在的字段（Project 类型没有
 * 演示 / 源码链接字段），因此本页不存在任何演示或源码入口；
 * 非法 slug 一律 notFound()。
 */
export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = findProject(slug);
  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-14 md:px-8">
      <GlassPanel className="relative overflow-hidden p-5 sm:p-7 lg:p-9">
        {/* 面板顶部弧形高光：与项目列表大板同款 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-white/95 to-transparent"
        />

        <div className="relative">
          <PageHeader
            eyebrow={project.category}
            title={project.name}
            back={{ href: "/projects", label: "返回项目列表" }}
          />

          {/* 标题行右侧：状态徽标（只写「探索中」，无上线 / 发布等虚构状态） */}
          <p className="sr-only">{`项目状态：${STATUS_LABEL}`}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-dashed border-line bg-white/45 px-3 py-1 text-xs font-medium leading-5 text-text-secondary">
            <FlaskConical className="size-3.5 text-blue" aria-hidden="true" />
            {STATUS_LABEL}
          </span>

          {/* 封面：概念视觉占位（参考图裁切，非真实运行界面），首屏大图 priority */}
          <figure className="m-0 mt-7">
            <div className="relative aspect-[2/1] overflow-hidden rounded-2xl border border-white/70 shadow-[0_16px_48px_rgba(71,115,183,0.16)]">
              <Image
                src={project.cover}
                alt={project.coverAlt}
                fill
                priority
                sizes="(min-width: 1024px) 71rem, 100vw"
                className="object-cover"
              />
              <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/75 px-2.5 py-0.5 text-[10px] font-medium text-text-secondary backdrop-blur-sm">
                概念视觉占位
              </span>
            </div>
            {/* 12px 图注小字：text-muted 不达 4.5:1，用 text-secondary */}
            <figcaption className="mt-2.5 text-xs leading-relaxed text-text-secondary">
              {project.coverAlt}
            </figcaption>
          </figure>

          {/* 描述与标签：两栏布局（移动端单列纵排） */}
          <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section aria-label="项目介绍">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-text-secondary">
                介绍
              </h2>
              <p className="mt-3 text-[15px] leading-[1.95] text-text-primary">
                {project.description}
              </p>
              <p className="mt-4 text-sm leading-[1.95] text-text-secondary">
                项目仍在持续打磨中，更多过程记录与阶段性成果会在完善后补充到这里。
              </p>
            </section>

            <section aria-label={`${project.name} 技术标签`}>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-text-secondary">
                技术标签
              </h2>
              <ul className="mt-3 flex list-none flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-white/60 bg-[#C8D7EB]/40 px-3 py-1 text-xs font-medium text-text-primary"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
