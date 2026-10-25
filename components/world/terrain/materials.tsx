"use client";

import { WORLD_COLORS } from "@/lib/world/constants";

/**
 * 冰蓝材质体系分层（蓝图 §3.2，brief §3「不同区域不同材质」）：
 *
 * | 层 | 预设 | 用途（区域分配） |
 * |---|---|---|
 * | 磨砂 | FrostRockMaterial | 主岛 / 三屿 / 远景岛岩体（roughness 0.85 面 shading） |
 * | 冰雪 | SnowFieldMaterial | 各可行走盘面（微反光 roughness 0.4） |
 * | 金属 | DeepMetalMaterial | 塔骨 / 拱脚 / 框架 / 穹舱基环（深蓝金属） |
 * | 半透明 | GlassPaneMaterial | 塔层盘 / 窗口卡座等玻璃构件（transparent+opacity 版） |
 * | 柔光 | CrystalGlowMaterial | 浮晶 / 导向标 / 蝶茧等自发光体（emissive，无后处理） |
 *
 * 红线：transmission 重型透射材质全场景 ≤3 mesh（蝶枢翼组 ×2 + Moss 穹舱 ×1），
 * 只在高档渲染、其余档降级为本模块的 GlassPaneMaterial——由调用方按
 * tier.transmissionBudget 门控（world-assets.test.mjs 源码级守护）。
 * 反光来自 SceneEnvironment 的程序化 PMREM 环境反射，无实时反射。
 */

/** 磨砂岩：岛体与一切石构（roughness 0.85 + flatShading 的矿物感） */
export function FrostRockMaterial({
  color = WORLD_COLORS.rockMid,
}: {
  color?: string;
}) {
  return <meshStandardMaterial color={color} roughness={0.85} flatShading />;
}

/** 冰雪面：可行走盘面（雪 / 冰微反光层，接收阴影的主表面） */
export function SnowFieldMaterial({
  color = WORLD_COLORS.snow,
}: {
  color?: string;
}) {
  return (
    <meshStandardMaterial color={color} roughness={0.4} metalness={0.06} />
  );
}

/** 深蓝金属：框架 / 塔骨 / 栏杆 / 基座（metalness 0.9 + 低粗糙） */
export function DeepMetalMaterial({
  color = WORLD_COLORS.rockDeep,
  roughness = 0.3,
}: {
  color?: string;
  roughness?: number;
}) {
  return <meshStandardMaterial color={color} metalness={0.9} roughness={roughness} />;
}

/** 半透明玻璃构件：塔层盘 / 卡座 / 光带檐（transmission 的降级同位替换） */
export function GlassPaneMaterial({
  color = WORLD_COLORS.glass,
  opacity = 0.5,
  roughness = 0.22,
  emissive,
  emissiveIntensity = 0.2,
}: {
  color?: string;
  opacity?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      transparent
      opacity={opacity}
      roughness={roughness}
      metalness={0.1}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
    />
  );
}

/** 柔光晶体：浮晶 / 导向标 / 蝶茧（emissive 模拟辉光，无后处理栈） */
export function CrystalGlowMaterial({
  color = WORLD_COLORS.iceEdge,
  glow = WORLD_COLORS.trailGlow,
  intensity = 0.4,
  roughness = 0.25,
}: {
  color?: string;
  glow?: string;
  intensity?: number;
  roughness?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={glow}
      emissiveIntensity={intensity}
      roughness={roughness}
      flatShading
    />
  );
}
