"use client";

import {
  Component,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { WorldUIProvider, useWorldUI } from "./WorldUIContext";
import { LoadingScreen, WorldBrand } from "./loading/LoadingScreen";
import { HudOverlay } from "./ui/HudOverlay";
import { IntroToast } from "./ui/IntroToast";
import { FallbackProjects } from "./ui/FallbackProjects";
import {
  FallbackResizeObserver,
  probeResizeObserverBroken,
  type ResizeObserverCtor,
} from "./systems/resizePolyfill";

/**
 * 世界客户端壳（蓝图 §10 / §13.1）：
 * - 根节点 id="world-root" 是首页沉浸 CSS 的契约锚点
 *   （body:has(#world-root) → Navbar 叠加、Footer 隐藏，零 JS）；
 * - WebGL 能力探测：可用 → dynamic(ssr:false) 装载 WorldCanvas；
 *   不可用 / 初始化抛错 → FallbackProjects 降级（§12.3）；
 * - SSR 首屏即含品牌 <h1>（SEO / 标题层级无缺口，§13.1），
 *   h1 节点常驻，世界就绪后经 CSS 过渡收缩为 HUD 左上角标。
 */

const WorldCanvas = dynamic(() => import("./WorldCanvas"), {
  ssr: false,
  loading: () => null,
});

/** Canvas 渲染期异常边界：任何 3D 侧错误都落到降级页，不白屏 */
class WorldErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/** WebGL 上下文试探：webgl2 → webgl，任一可用即认为可承载世界 */
function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

/**
 * 客户端环境快照（useSyncExternalStore 惰性求值 + 模块级缓存）：
 * SSR 渲染安全快照（null / false），客户端首帧读真实值，不触发级联渲染。
 */
const noopSubscribe = () => () => {};
let cachedWebgl: boolean | null = null;
const getWebglSnapshot = () => {
  cachedWebgl ??= detectWebGL();
  return cachedWebgl;
};
const getWebglServerSnapshot = () => null;
let cachedMobileLike: boolean | null = null;
const getMobileLikeSnapshot = () => {
  cachedMobileLike ??=
    window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
  return cachedMobileLike;
};
const getMobileLikeServerSnapshot = () => false;

function WorldShellInner() {
  const { phase, setPhase, isMobileLike } = useWorldUI();
  const webgl = useSyncExternalStore(
    noopSubscribe,
    getWebglSnapshot,
    getWebglServerSnapshot,
  );
  /**
   * ResizeObserver 兜底探测：个别嵌入式 WebView 原生 RO 不回调，会让
   * Canvas 容器测量停在 0×0（世界永不初始化）。探测期（undefined）暂缓
   * 挂载 Canvas，加载屏覆盖；原生可用则不注入 polyfill（真实浏览器零改动）。
   */
  const [roPolyfill, setRoPolyfill] = useState<ResizeObserverCtor | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    probeResizeObserverBroken().then((broken) => {
      if (!cancelled) setRoPolyfill(broken ? FallbackResizeObserver : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // WebGL 不可用：直接走降级相位
  useEffect(() => {
    if (webgl === false && phase === "loading") setPhase("fallback");
  }, [webgl, phase, setPhase]);

  const handleReady = useCallback(() => {
    setPhase("ready");
  }, [setPhase]);

  const handleFatal = useCallback(() => {
    setPhase("fallback");
  }, [setPhase]);

  const engineReady = webgl === true && phase !== "loading";

  return (
    <div id="world-root" className="world-root" data-world-phase={phase}>
      {webgl === false ? (
        <FallbackProjects />
      ) : roPolyfill === undefined ? null : (
        <WorldErrorBoundary onError={handleFatal}>
          <WorldCanvas
            isMobileLike={isMobileLike}
            onReady={handleReady}
            resizePolyfill={roPolyfill ?? undefined}
          />
        </WorldErrorBoundary>
      )}

      {/* 加载屏常驻（h1 节点不卸载），世界就绪后淡出；品牌角标随之收缩 */}
      <LoadingScreen active={phase === "loading"} engineReady={engineReady}>
        <WorldBrand ready={phase !== "loading"} />
      </LoadingScreen>

      {phase === "ready" ? (
        <>
          <HudOverlay />
          <IntroToast />
        </>
      ) : null}
    </div>
  );
}

export function WorldShell() {
  // 设备形态判定（§6.3：粗指针或窄屏 → 移动端档）；SSR 安全快照为 false
  const isMobileLike = useSyncExternalStore(
    noopSubscribe,
    getMobileLikeSnapshot,
    getMobileLikeServerSnapshot,
  );

  return (
    <WorldUIProvider isMobileLike={isMobileLike}>
      <WorldShellInner />
    </WorldUIProvider>
  );
}
