"use client";

import { useEffect, useMemo } from "react";
import { BackSide, CanvasTexture, SRGBColorSpace, SphereGeometry } from "three";
import { WORLD_COLORS } from "@/lib/world/constants";
import { WORLD_SCALE } from "@/lib/world";

/**
 * 天空穹（蓝图 §2.3 / §3.1）：r=380 内球面 + 程序化竖向渐变
 * （#9CD8FF 天顶 → #EAF7FF 地平线），fog:false 不受雾影响；
 * 纹理由 canvas 本地生成（零外部资源），卸载时 dispose。
 */
export function SkyDome() {
  const geometry = useMemo(
    () => new SphereGeometry(WORLD_SCALE.skyDomeRadius, 32, 24),
    [],
  );
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const gradient = ctx?.createLinearGradient(0, 0, 0, canvas.height);
    if (ctx && gradient) {
      gradient.addColorStop(0, "#7FC6FF");
      gradient.addColorStop(0.38, WORLD_COLORS.skyTop);
      gradient.addColorStop(0.56, WORLD_COLORS.skyHorizon);
      gradient.addColorStop(1, "#E3F1FC");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, []);

  useEffect(
    () => () => {
      texture.dispose();
      geometry.dispose();
    },
    [texture, geometry],
  );

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial map={texture} side={BackSide} fog={false} />
    </mesh>
  );
}

/** 供 CloudLayer 复用的柔云纹理工厂（程序化 canvas，零外部资源） */
export function createSoftBlobTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.55, "rgba(236,248,255,0.55)");
    gradient.addColorStop(1, "rgba(236,248,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}
