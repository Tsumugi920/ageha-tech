"use client";

import {
  Fragment,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import { HeroScene } from "@/components/home/HeroScene";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/** 入场渐显的分层延迟：eyebrow → 标题 → 简介 → 按钮 → 统计 → 辅助栏 */
const reveal = (delay: string): CSSProperties =>
  ({ "--reveal-delay": delay }) as CSSProperties;

/** 右缘章节速览：装饰性锚点，映射到站内真实版块 */
const CHAPTERS = [
  { num: "01", label: "Explore", href: "#home" },
  { num: "02", label: "Build", href: "#projects" },
  { num: "03", label: "Create", href: "#notes" },
  { num: "04", label: "Iterate", href: "#journey" },
  { num: "05", label: "Share", href: "#contact" },
  { num: "06", label: "More", href: "#about" },
] as const;

/**
 * 摘要统计（口径与站内可数内容逐项对齐，不做推算式夸大）：
 * - 3+ 代表项目 = lib/projects.ts 的 3 个项目；
 * - 16 在用/在学技术 = lib/tech-stack.ts 四组 × 四项的实际计数；
 * - ∞ 持续探索为装饰性表达，不承载可核验的数值声明。
 */
const STATS = [
  { value: "3+", label: "代表项目" },
  { value: "16", label: "在用/在学技术" },
  { value: "∞", label: "持续探索" },
] as const;

/**
 * Hero 首屏：满屏高度，桌面左文右景双栏 + 右缘章节面板 + 左缘 SCROLL 提示。
 *
 * - 动效克制：纯 CSS 关键帧（入场渐显 / 悬浮 / 轨道 / 光点），
 *   另以两个轻量 effect 提供 IntersectionObserver 离屏暂停与鼠标视差；
 * - prefers-reduced-motion 下所有动画静止（见 globals.css hero 块）；
 * - 无 JS 时文字与场景图仍完整可读（SSR 直出，动效仅为增强）。
 */
export function Hero() {
  const rootRef = useRef<HTMLElement>(null);

  // 滚出视口时暂停全部装饰动画，回到首屏自动恢复
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        root.setAttribute(
          "data-hero-active",
          entry.isIntersecting ? "true" : "false",
        );
      },
      { threshold: 0.04 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // 鼠标视差：仅精确指针 + 未开启减弱动效时启用，写入 CSS 变量
  // （平滑由 .hero-parallax 的 transform transition 提供，无需逐帧 JS 动画）
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const apply = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      root.style.setProperty("--hero-px", px.toFixed(3));
      root.style.setProperty("--hero-py", py.toFixed(3));
    };
    const onLeave = () => {
      root.style.setProperty("--hero-px", "0");
      root.style.setProperty("--hero-py", "0");
    };

    root.addEventListener("pointermove", apply);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", apply);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      id="home"
      data-hero-active="true"
      aria-label="首屏"
      className="hero-root relative isolate flex min-h-[calc(100svh-4.5rem)] flex-col overflow-hidden lg:grid lg:h-[clamp(720px,calc(100svh-4.5rem),960px)] lg:min-h-0 lg:grid-cols-[42fr_58fr] lg:grid-rows-1"
    >
      {/* 首屏局部氛围：左上加深的天空蓝（压暗首屏左上、衬托深藏青品牌字） */}
      <div
        aria-hidden="true"
        className="hero-atmosphere pointer-events-none absolute inset-0 z-0"
      />

      {/* 右侧主视觉场景（移动端收为上半区横幅，lg+ 落到两栏栅格右列） */}
      <HeroScene />

      {/* 左侧文案栏：移动端在 46svh 场景横幅之下堆叠；lg+ 为 42% 左栏，
          顶部 clamp 上移（无下坠），eyebrow 落到首屏 ~20-25% 高。
          左缘 hero-inset-pl 对齐全站主容器内容缘（非视口 gutter；
          类内自带 ≥1600px 宽容器分层，见 globals.css） */}
      <div className="relative z-10 mx-auto flex w-full flex-1 flex-col justify-center px-6 pb-16 pt-[46svh] sm:px-10 hero-inset-pl lg:col-start-1 lg:row-start-1 lg:pr-(--site-gutter) lg:pb-14 lg:pt-[clamp(4rem,8svh,7rem)]">
        <div className="max-w-[34rem]">
          <p
            className="hero-reveal font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-[#16325E]/85 sm:text-xs"
            style={reveal("0ms")}
          >
            {site.identity}
          </p>

          {/* 品牌标题组合：Ageha.tech + 中文双行标语 */}
          <h1
            className="hero-reveal mt-5"
            style={reveal("90ms")}
            lang="zh-CN"
          >
            <span className="block font-display text-[clamp(3.1rem,5.5vw,5.5rem)] font-bold leading-[0.95] tracking-tight">
              {/* 深藏青与第二行中文同墨：白字在浅蓝天空上实测仅 1.27~1.76:1，
                  加深氛围层最多也只能到 2.55:1，改用深色文字后 ≥11.4:1 */}
              <span className="text-[#193154]">Ageha.</span>
              <span className="hero-gradient-tech">tech</span>
            </span>
            <span className="mt-6 block font-black leading-[1.22] tracking-[0.02em] text-[clamp(1.8rem,3.2vw,2.75rem)]">
              <span className="block text-[#193154]">用技术构建</span>
              <span className="hero-gradient-zh block">更有趣的数字世界。</span>
            </span>
          </h1>

          <p
            className="hero-reveal mt-6 max-w-[34rem] text-[15px] leading-[1.95] text-[#22337C]/90 sm:text-base"
            style={reveal("180ms")}
          >
            我是 Ageha，一名独立开发者，热爱探索技术与设计的边界，致力于构建有价值、
            <span className="hero-gradient-accent font-semibold">
              有趣且优雅
            </span>
            的数字产品。
          </p>

          <div
            className="hero-reveal mt-9 flex flex-wrap items-center gap-3.5"
            style={reveal("270ms")}
          >
            <Link href="/projects" className="hero-primary-btn">
              查看我的项目
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href="#about" className="hero-ghost-btn">
              了解我
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>

          <dl
            className="hero-reveal mt-10 flex flex-wrap items-center gap-x-7 gap-y-5 sm:gap-x-9"
            style={reveal("360ms")}
          >
            {STATS.map((stat, index) => (
              <Fragment key={stat.label}>
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="hidden h-10 w-px bg-[#457EC2]/30 sm:block"
                  />
                )}
                <div className="flex flex-col-reverse gap-1.5">
                  <dt className="text-xs tracking-[0.08em] text-[#3A5580]">
                    {stat.label}
                  </dt>
                  <dd className="font-display text-[26px] font-bold leading-none text-[#011455] sm:text-3xl">
                    {stat.value}
                  </dd>
                </div>
              </Fragment>
            ))}
          </dl>
        </div>
      </div>

      {/* 右缘窄竖排信息面板：幽灵级轻玻璃（低不透明度 + 细边 + 极轻投影），
          刻意退到场景之后——主视觉主角是蝴蝶与城市，面板只提供章节速览锚点。
          文字用深藏青系，在 30% 白玻璃底上对比度 ≥6:1。
          外缘用 hero-inset-r 对齐全站主容器内容缘（非视口 gutter） */}
      <aside
        aria-label="章节速览"
        className="hero-reveal hero-inset-r absolute top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-5 rounded-[1.9rem] border border-white/45 bg-white/30 px-4 py-6 shadow-[0_3px_14px_rgba(71,115,183,0.10)] backdrop-blur-md lg:flex"
        style={reveal("640ms")}
      >
        <span className="hero-vtext max-h-40 font-mono text-[10px] font-medium uppercase leading-[2.1] tracking-[0.26em] text-[#24457A]">
          BUILDING DIGITAL THINGS WITH CURIOSITY.
        </span>

        <svg
          aria-hidden="true"
          viewBox="0 0 40 20"
          fill="none"
          className="hero-pulse w-9"
        >
          <defs>
            <linearGradient
              id="hero-pulse-grad"
              x1="0"
              y1="10"
              x2="40"
              y2="10"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#54E3FF" />
              <stop offset="1" stopColor="#9C83FF" />
            </linearGradient>
          </defs>
          <path
            d="M1 11H9L12.5 4.5L17 16L20.5 7.5L23 11H39"
            stroke="url(#hero-pulse-grad)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span
          aria-hidden="true"
          className="h-px w-14 bg-gradient-to-r from-transparent via-[#3E6EA8]/40 to-transparent"
        />

        <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-[#24457A]">
          <ChevronLeft className="size-3.5 text-[#3E6EA8]" aria-hidden="true" />
          <span className="font-semibold text-[#0B2B5C]">01</span>
          <span className="text-[#24457A]">/ 06</span>
        </p>

        <nav aria-label="首屏章节" className="flex flex-col items-start">
          {CHAPTERS.map((chapter, index) => (
            <a
              key={chapter.num}
              href={chapter.href}
              aria-current={index === 0 ? "true" : undefined}
              className={cn(
                "py-3.5 font-mono text-[11px] tracking-[0.14em] transition-colors duration-300",
                index === 0
                  ? "font-semibold text-[#0B2B5C]"
                  : /* 非激活章节是可点击链接：不透明 + 加深，白45玻璃底实测 ≥5.6:1 */
                    "text-[#2A4C80] hover:text-[#0B2B5C]",
              )}
            >
              <span aria-hidden="true">{chapter.num}.</span>{" "}
              <span>{chapter.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* 左缘 SCROLL 竖排滚动提示（与文案列同一容器内容缘起点，仅 lg+ 可见） */}
      <div
        aria-hidden="true"
        className="hero-reveal hero-inset-l absolute bottom-10 z-20 hidden flex-col items-center gap-3 lg:flex"
        style={reveal("760ms")}
      >
        <span className="hero-vtext font-mono text-[10px] font-medium tracking-[0.32em] text-[#24457A]">
          SCROLL
        </span>
        <ChevronUp className="size-3 text-[#3E6EA8]/80" aria-hidden="true" />
        <span className="relative h-16 w-px bg-gradient-to-b from-[#3E6EA8]/5 via-[#3E6EA8]/50 to-[#3E6EA8]/5">
          <span className="hero-knob absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border border-[#2F8DF2]/80 bg-white/90 shadow-[0_0_10px_rgba(11,157,247,0.65)]" />
        </span>
        <ChevronDown className="size-3 text-[#3E6EA8]/80" aria-hidden="true" />
      </div>
    </section>
  );
}
