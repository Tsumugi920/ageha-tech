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
 * + 一行四个等宽玻璃子卡，每卡分组名 + 2×2/1×4 彩色图标矩阵。
 * 数据见 lib/tech-stack.ts（不含任何熟练度声明）。
 */
export function TechStackSection() {
  return (
    <section
      id="tech"
      aria-label="技术栈"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 md:px-8"
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

      {/* 四个等宽玻璃子卡（移动 2×2，桌面 1×4） */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {techGroups.map((group) => (
          <div key={group.name} className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-bold text-text-primary">
              {group.name}
            </h3>
            <ul className="mt-4 grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4">
              {group.items.map((item) => {
                const Icon = TECH_ICONS[item.icon];
                return (
                  <li
                    key={item.name}
                    className="flex flex-col items-center gap-1.5 text-center"
                  >
                    <span
                      className="flex size-10 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${item.color}14`,
                        color: item.color,
                      }}
                    >
                      <Icon className="size-[22px]" aria-hidden="true" />
                    </span>
                    <span className="text-[11px] leading-tight text-text-secondary">
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
