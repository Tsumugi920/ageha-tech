import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Asterisk,
  Atom,
  Box,
  Container,
  Database,
  FileType,
  Flower2,
  GitBranch,
  Hexagon,
  Layers,
  Leaf,
  Shell,
  SquareCode,
  Terminal,
  Wind,
  Worm,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { techGroups, type TechIconKey } from "@/lib/tech-stack";

/** icon 键 → lucide 组件的统一映射（尺寸与线条风格全段一致） */
const TECH_ICONS: Record<TechIconKey, LucideIcon> = {
  atom: Atom,
  layers: Layers,
  "file-type": FileType,
  wind: Wind,
  hexagon: Hexagon,
  worm: Worm,
  database: Database,
  leaf: Leaf,
  "git-branch": GitBranch,
  container: Container,
  "square-code": SquareCode,
  terminal: Terminal,
  flower: Flower2,
  asterisk: Asterisk,
  box: Box,
  shell: Shell,
};

/**
 * 技术栈：头部行（eyebrow + 标题 + 行内副题 + 右侧「查看更多」）
 * + 一行四张分类玻璃卡（前端开发 / 后端与数据 / 开发工具 / 在做的方向），
 * 每卡为分类标题 + 「图标底板 + 技术名称」纵向列表——
 * 图标底板尺寸、圆角、着色方式（item.color 14% 底 + 同色图标）全列表统一，
 * 技术名称用 14px 正文色，可读不似脚注。
 * 数据见 lib/tech-stack.ts（只含真实在用 / 在学的 4 组 × 4 项，不凑版面）。
 */
export function TechStackSection() {
  return (
    <section
      id="tech"
      aria-label="技术栈"
      className="site-container scroll-mt-24 py-20"
    >
      {/* 头部行：左 eyebrow + 标题 + 行内副题，右「查看更多 →」 */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-3">
          <Badge>Tech Stack</Badge>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
              技术栈
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary">
              通过真实项目积累经验，以持续学习拓展能力边界。
            </p>
          </div>
        </div>
        <a
          href="/tech"
          className="tap-44 group inline-flex shrink-0 items-center gap-1.5 pb-1 text-sm font-semibold text-link transition-colors hover:text-link-hover"
        >
          查看更多
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
      </div>

      {/* 四张分类玻璃卡（移动 1 列，sm 2 列，xl 4 列） */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {techGroups.map((group) => (
          <div key={group.name} className="glass-card rounded-2xl p-6">
            <h3 className="text-sm font-bold text-text-primary">
              {group.name}
            </h3>
            {/* 图标 + 名称纵向列表：底板尺寸 / 圆角 / 着色方式全卡统一
                （底板 44px / 图标 24px / 名称 14px：作品展示级可辨识度） */}
            <ul className="mt-5 flex list-none flex-col gap-3">
              {group.items.map((item) => {
                const Icon = TECH_ICONS[item.icon];
                return (
                  <li key={item.name} className="flex items-center gap-3.5">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${item.color}14`,
                        color: item.color,
                      }}
                    >
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="text-sm leading-tight text-text-primary">
                      {item.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
