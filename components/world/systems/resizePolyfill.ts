/**
 * ResizeObserver 探测与兜底（brief §10 初始化失败要有合理处理）。
 *
 * 背景：@react-three/fiber 用 react-use-measure（依赖 ResizeObserver）测量
 * 容器，容器尺寸为 0 时 Canvas 永不初始化（停在加载屏）。个别嵌入式
 * WebView 的原生 ResizeObserver 不回调（本机 ZCode 内置浏览器实测如此），
 * 真实桌面 / 移动浏览器不受影响。
 *
 * 方案：加载屏阶段探测原生 ResizeObserver 是否回调；失效则向 Canvas 传入
 * react-use-measure 支持的 polyfill（初次 observe 即回报 + 窗口 resize /
 * orientationchange 回报），世界照常点亮。
 */

export type ResizeObserverCtor = new (callback: ResizeObserverCallback) => ResizeObserver;

/**
 * 探测原生 ResizeObserver 是否可用：observe(body) 后 timeoutMs 内回调则可用。
 * 返回 true = 原生失效，需要 polyfill。
 */
export function probeResizeObserverBroken(timeoutMs = 700): Promise<boolean> {
  return new Promise((resolve) => {
    if (
      typeof window === "undefined" ||
      typeof ResizeObserver === "undefined"
    ) {
      resolve(true);
      return;
    }
    let settled = false;
    const observer = new ResizeObserver(() => {
      settled = true;
      observer.disconnect();
      resolve(false);
    });
    observer.observe(document.body);
    window.setTimeout(() => {
      if (!settled) {
        observer.disconnect();
        resolve(true);
      }
    }, timeoutMs);
  });
}

/** 简化兜底：observe 即回报当前尺寸；窗口 resize / 方向变化再回报全部 */
export class FallbackResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;
  private readonly targets = new Set<Element>();
  private readonly onWindowResize = () => this.emitAll();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    this.targets.add(target);
    window.addEventListener("resize", this.onWindowResize);
    window.addEventListener("orientationchange", this.onWindowResize);
    // 初次 observe 用微任务回报当前尺寸（对齐原生「observe 即回调」语义）
    queueMicrotask(() => this.emit(target));
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("orientationchange", this.onWindowResize);
  }

  private emit(target: Element): void {
    const rect = target.getBoundingClientRect();
    const entry = {
      target,
      contentRect: rect,
      borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
      contentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
      devicePixelContentBoxSize: [],
      inlineSize: rect.width,
      blockSize: rect.height,
    } as ResizeObserverEntry;
    this.callback([entry], this);
  }

  private emitAll(): void {
    for (const target of this.targets) this.emit(target);
  }
}
