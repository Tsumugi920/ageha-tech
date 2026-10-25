"use client";

import { useEffect, type ReactNode } from "react";
import { useProgress } from "@react-three/drei";
import { ButterflyLogo } from "@/components/layout/ButterflyLogo";
import { cn } from "@/lib/utils";

/**
 * 加载屏（蓝图 §13.2）：真实进度 + 品牌屏。
 * - 品牌标题（含首页唯一 <h1>）作为 children 传入——组件常驻不卸载，
 *   h1 节点随世界就绪经 CSS 过渡收缩为 HUD 左上品牌角标（§13.1，节点不换）；
 * - 进度来自 drei useProgress 的真实资产计数（首屏零大纹理，进度快是
 *   真实结果）；无资产加载时显示阶段文案，绝不显示假百分比；
 * - 世界就绪后整体淡出并放行指针事件。
 */
export function LoadingScreen({
  active,
  engineReady,
  children,
}: {
  active: boolean;
  /** Canvas 是否已创建（区分「引擎载入中」与「资产载入中」两段文案） */
  engineReady: boolean;
  children: ReactNode;
}) {
  const { active: assetsLoading, progress, loaded, total } = useProgress();

  // 加载期禁止底层画布滚动 / 拖拽误触
  useEffect(() => {
    if (!active) return;
    const onWheel = (event: WheelEvent) => event.preventDefault();
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [active]);

  const showAssets = engineReady && assetsLoading && total > 0;

  return (
    <div
      className={cn("world-loading", active ? "world-loading--active" : "world-loading--done")}
      aria-hidden={!active}
    >
      <div className="world-loading__brand">
        {children}
        <div className="world-loading__progress" role="status" aria-live="polite">
          {/* 不确定态为扫描光带；有真实资产时以文本呈现真实计数与百分比
              （useProgress 实测值），不用假进度宽度 */}
          <div
            className="world-loading__bar"
            data-state={showAssets ? "assets" : "engine"}
          />
          <p className="world-loading__text">
            {showAssets
              ? `正在点亮群岛… ${Math.round(progress)}%（${loaded}/${total}）`
              : "正在点亮群岛…"}
          </p>
        </div>
      </div>
    </div>
  );
}

/** 品牌大字（加载态）/ 角标（就绪态）的通用品牌标头（含 h1，见 §13.1） */
export function WorldBrand({ ready }: { ready: boolean }) {
  return (
    <header className={cn("world-brand", ready && "world-brand--dock")}>
      <ButterflyLogo gradientId="world-butterfly" decorative className="world-brand__logo" />
      <h1 className="world-brand__title">Ageha.tech</h1>
      <p className="world-brand__tagline">用技术构建更有趣的数字世界</p>
    </header>
  );
}
