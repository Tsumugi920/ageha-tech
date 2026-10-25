import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowUpRight, FlaskConical, Globe } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { projects } from "@/lib/projects";

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
 * 项目详情页：封面（按 coverKind 如实标注）+ 类别 + 描述 + 技术标签
 * + 如实状态徽标 + 真实入口按钮（仅渲染 lib/projects.ts 里存在的 links）
 * + 返回列表链接。
 *
 * 【诚实边界】状态与入口一律来自项目数据（站长仓库 README 载明的事实）：
 * 没有上线记录的项目不渲染任何入口；本页源码不出现字面外链。
 * 非法 slug 一律 notFound()。
 */
export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = findProject(slug);
  if (!project) {
    notFound();
  }
  const isLive = project.status === "已上线";

  return (
    <div className="site-container pb-20 pt-14">
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

          {/* 标题行右侧：状态徽标（文案来自项目数据）+ 真实入口按钮 */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="sr-only">{`项目状态：${project.status}`}</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium leading-5 ${
                isLive
                  ? "border border-blue/30 bg-[#D9EDFF]/70 text-text-primary"
                  : "border border-dashed border-line bg-white/45 text-text-secondary"
              }`}
            >
              {isLive ? (
                <Globe className="size-3.5 text-blue" aria-hidden="true" />
              ) : (
                <FlaskConical className="size-3.5 text-blue" aria-hidden="true" />
              )}
              {project.status}
            </span>
            {project.links?.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1.5 rounded-full bg-linear-to-br from-cyan to-blue px-4 py-1.5 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(38,157,255,0.30)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {link.label}
                <ArrowUpRight
                  className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>

          {/* 封面：按 coverKind 渲染徽标（真实界面截图不挂占位徽标），首屏大图 priority */}
          <figure className="m-0 mt-7">
            <div className="relative aspect-[2/1] overflow-hidden rounded-2xl border border-white/70 shadow-[0_16px_48px_rgba(71,115,183,0.16)]">
              <Image
                src={project.cover}
                alt={project.coverAlt}
                fill
                priority
                sizes="(min-width: 1024px) 71rem, 100vw"
                style={project.coverPosition ? { objectPosition: project.coverPosition } : undefined}
                className="object-cover"
              />
              {project.coverKind === "concept" && (
                <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/75 px-2.5 py-0.5 text-[10px] font-medium text-text-secondary backdrop-blur-sm">
                  概念视觉占位
                </span>
              )}
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
                更多过程记录与阶段性成果会在完善后补充到这里。
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
                    className="rounded-full border border-white/60 bg-[#C8D7EB]/40 px-3 py-1 text-[13px] font-medium text-text-primary"
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
