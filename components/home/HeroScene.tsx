import type { CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type HeroParticle = {
  /** 水平位置（场景容器百分比） */
  x: string;
  /** 垂直位置（场景容器百分比） */
  y: string;
  /** 光点直径 */
  s: string;
  /** 漂浮周期 */
  d: string;
  /** 相位延迟 */
  dl: string;
  /** 仅 ≥sm 屏幕渲染：移动端减半光点数量，持续运行的 CSS 动画更克制 */
  desktopOnly?: boolean;
};

/** 漂浮光点：围绕蝴蝶主视觉稀疏散布，节奏各不相同（克制数量，避免喧宾夺主） */
const PARTICLES: readonly HeroParticle[] = [
  { x: "14%", y: "24%", s: "5px", d: "7.5s", dl: "0s" },
  { x: "76%", y: "16%", s: "4px", d: "9s", dl: "1.2s", desktopOnly: true },
  { x: "62%", y: "72%", s: "6px", d: "8s", dl: "0.6s" },
  { x: "30%", y: "64%", s: "3px", d: "6.5s", dl: "2s" },
  { x: "88%", y: "46%", s: "4px", d: "10s", dl: "0.3s", desktopOnly: true },
  { x: "44%", y: "10%", s: "3px", d: "8.5s", dl: "1.6s" },
  { x: "8%", y: "52%", s: "3px", d: "9.5s", dl: "2.4s", desktopOnly: true },
  { x: "70%", y: "36%", s: "4px", d: "7s", dl: "3s", desktopOnly: true },
] as const;

/** 内联 CSS 变量（装饰动画参数），交由 globals.css 的 hero-* 类消费 */
const cssVars = (vars: Record<string, string>): CSSProperties =>
  vars as CSSProperties;

/**
 * Hero 主视觉场景：hero-clean.png 场景插画（水晶蝴蝶 + 悬浮尖塔城市 + 光环）
 * 叠加 CSS 绘制的柔和光晕、双轨道环与漂浮光点形成纵深。
 *
 * - 场景图边缘通过径向遮罩渐隐，自然过渡到页面冰蓝底色；
 * - 动画全部为 CSS 关键帧（悬浮 / 呼吸 / 旋转 / 漂浮），
 *   视差偏移量由 Hero 写入的 --hero-px / --hero-py 变量驱动；
 * - 移动端动效减量：第二条轨道环与半数光点仅在 ≥sm / lg 渲染，
 *   轨道与光晕尺寸随断点收缩（见 globals.css .hero-orbit-layer）；
 * - 整体装饰性质：aria-hidden，场景图 alt=""。
 */
export function HeroScene() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[46svh] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-[64%]"
    >
      {/* 最深一层：蝴蝶后方柔和光晕（呼吸）；移动端光晕随断点缩小 */}
      <div className="hero-parallax hero-px-deep absolute inset-0">
        <div className="hero-glow absolute left-1/2 top-[44%] aspect-square w-[clamp(14rem,44vw,40rem)] -translate-x-1/2 -translate-y-1/2 rounded-full lg:w-[clamp(22rem,44vw,40rem)]" />
      </div>

      {/* 场景主视觉：缓慢悬浮 + 边缘遮罩渐隐（径向 + 横向双层嵌套渐隐） */}
      <div className="hero-parallax hero-px-scene absolute inset-0">
        <div className="hero-float absolute inset-0 hero-fade-x">
          <Image
            src="/images/hero-clean.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 64vw, 100vw"
            className="hero-scene-mask object-cover object-[56%_46%]"
          />
        </div>
      </div>

      {/* 细轨道环：父层倾斜压扁成椭圆，子层旋转出环绕光弧。
          移动 / 平板只保留一条轨道（第二环 lg+ 才渲染），尺寸随断点收缩 */}
      <div className="hero-parallax hero-px-orbit hero-orbit-layer absolute inset-0">
        <div
          className="hero-orbit-tilt"
          style={cssVars({ "--orbit-size": "var(--orbit-a)" })}
        >
          <div className="hero-orbit" />
        </div>
        <div
          className="hero-orbit-tilt hero-orbit-tilt-b hidden lg:block"
          style={cssVars({ "--orbit-size": "var(--orbit-b)" })}
        >
          <div className="hero-orbit hero-orbit-b" />
        </div>
      </div>

      {/* 最远一层：漂浮光点（移动端渲染一半，≥sm 恢复全量） */}
      <div className="hero-parallax hero-px-far absolute inset-0">
        {PARTICLES.map((particle) => (
          <span
            key={`${particle.x}-${particle.y}`}
            className={cn(
              "hero-particle",
              particle.desktopOnly && "hidden sm:block",
            )}
            style={cssVars({
              "--x": particle.x,
              "--y": particle.y,
              "--s": particle.s,
              "--d": particle.d,
              "--dl": particle.dl,
            })}
          />
        ))}
      </div>
    </div>
  );
}
