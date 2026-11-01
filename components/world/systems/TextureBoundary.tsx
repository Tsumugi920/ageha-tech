"use client";

import { Component, type ReactNode } from "react";

/**
 * 局部纹理错误边界：按需加载的屏幕 / 画廊贴图失败时只替换该屏幕，
 * 不把整个 Canvas 抛到世界降级页。重试由页面刷新负责。
 */
export class TextureBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
