"use client";

import { useEffect, useMemo } from "react";
import { BackSide, CanvasTexture, SRGBColorSpace, SphereGeometry } from "three";
import { WORLD_COLORS } from "@/lib/world/constants";
import { WORLD_SCALE } from "@/lib/world";

/**
 * 天空穹（R2 重绘）：r=380 内球面 + 程序化天空画布。
 * 竖向冷色渐变（深冰蓝天顶 → 冷白地平线 → 冰海底色），叠加暖色晨光晕
 * 与两条极淡的高空云带；fog:false 不受雾影响。
 * 纹理由 canvas 本地生成（零外部资源），卸载时 dispose。
 */
export function SkyDome() {
  const geometry = useMemo(
    () => new SphereGeometry(WORLD_SCALE.skyDomeRadius, 48, 32),
    [],
  );
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#5EA9E6");
      gradient.addColorStop(0.24, WORLD_COLORS.skyTop);
      gradient.addColorStop(0.46, "#B9DFF8");
      gradient.addColorStop(0.56, WORLD_COLORS.skyHorizon);
      gradient.addColorStop(0.6, "#F7FCFF");
      gradient.addColorStop(0.64, "#C9E6F8");
      // R12.0-D（G3）：地平线以下的穹顶色带从「海色」改为「雾色」——
      // 海盘（±1000m）在 ~375m 处被穹顶（r=380）遮断，旧版画带用海色
      // 与真实雾化海面（fog #B7D6EC）形成一条拼接线 + 行星边缘弧；
      // 现在画带在海天线以下直接过渡到雾色，海盘淡入穹顶，无接缝
      gradient.addColorStop(0.7, WORLD_COLORS.fog);
      gradient.addColorStop(1, WORLD_COLORS.fog);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 晨光：柔和径向亮斑（与主方向光同方位）
      const sun = ctx.createRadialGradient(720, 142, 8, 720, 142, 168);
      sun.addColorStop(0, "rgba(255,248,235,0.94)");
      sun.addColorStop(0.22, "rgba(255,246,232,0.5)");
      sun.addColorStop(0.6, "rgba(255,243,226,0.14)");
      sun.addColorStop(1, "rgba(255,243,226,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 高空冷色光带：极淡的青 / 淡紫横向渐变，给上方天空一点大气层次，
      // 不承担光源语义（真实光照仍来自 SunLight）。
      ctx.globalCompositeOperation = "screen";
      const aurora = ctx.createLinearGradient(0, 70, 1024, 190);
      aurora.addColorStop(0, "rgba(124,206,255,0)");
      aurora.addColorStop(0.32, "rgba(143,214,255,0.09)");
      aurora.addColorStop(0.62, "rgba(199,182,255,0.065)");
      aurora.addColorStop(1, "rgba(124,206,255,0)");
      ctx.fillStyle = aurora;
      ctx.fillRect(0, 60, 1024, 140);
      ctx.globalCompositeOperation = "source-over";

      // 高空云带：极淡的横向软椭圆，给天空一点方向性
      ctx.globalCompositeOperation = "screen";
      for (const band of [
        { x: 260, y: 286, w: 420, h: 34, a: 0.16 },
        { x: 610, y: 330, w: 520, h: 28, a: 0.12 },
        { x: 880, y: 268, w: 300, h: 22, a: 0.1 },
      ]) {
        const cloud = ctx.createRadialGradient(band.x, band.y, 4, band.x, band.y, band.w);
        cloud.addColorStop(0, `rgba(255,255,255,${band.a})`);
        cloud.addColorStop(0.5, `rgba(238,250,255,${band.a * 0.6})`);
        cloud.addColorStop(1, "rgba(238,250,255,0)");
        ctx.save();
        ctx.translate(band.x, band.y);
        ctx.scale(1, band.h / band.w);
        ctx.translate(-band.x, -band.y);
        ctx.fillStyle = cloud;
        ctx.fillRect(band.x - band.w, band.y - band.w, band.w * 2, band.w * 2);
        ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";

      // 地平线冷色薄雾，压住海天线
      const horizon = ctx.createLinearGradient(0, 300, 0, 350);
      horizon.addColorStop(0, "rgba(238,250,255,0)");
      horizon.addColorStop(0.55, "rgba(232,248,255,0.42)");
      horizon.addColorStop(1, "rgba(226,244,255,0)");
      ctx.fillStyle = horizon;
      ctx.fillRect(0, 300, canvas.width, 50);
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
      <meshBasicMaterial map={texture} side={BackSide} fog={false} toneMapped={false} />
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
