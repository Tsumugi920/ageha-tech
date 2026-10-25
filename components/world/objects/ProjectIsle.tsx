"use client";

import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { Html } from "@react-three/drei";
import { projects } from "@/lib/projects";
import type { ProjectIsle as ProjectIsleData } from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import { createFloatingRockGeometry } from "../terrain/FloatingRock";

/**
 * 项目屿（阶段 1 占位体量：简单体量 + 名牌 + 主题色弱光）。
 * 正式造型（悬浮终端塔 / 行情观测环 / 生态穹舱）在阶段 2 落地，
 * 本组件先建立三屿的尺度 / 位置 / 颜色 / 名牌差异与项目数据关联
 * （名称与状态如实来自 lib/projects.ts，Moss World 无链接不渲染入口）。
 */
export function ProjectIsle({ isle }: { isle: ProjectIsleData }) {
  const project = projects.find((item) => item.slug === isle.slug);
  const rockGeometry = useMemo(
    () => createFloatingRockGeometry(isle.radius, isle.radius * 0.85, 40),
    [isle.radius],
  );
  useEffect(() => () => rockGeometry.dispose(), [rockGeometry]);

  return (
    <group position={[isle.center.x, isle.center.y, isle.center.z]}>
      {/* 浮石基座 + 雪面（顶面 = 可行走盘面高度） */}
      <mesh geometry={rockGeometry} receiveShadow castShadow>
        <meshStandardMaterial color={WORLD_COLORS.rockMid} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, -0.13, 0]} scale={[isle.radius * 0.985, 1, isle.radius * 0.985]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.26, 40]} />
        <meshStandardMaterial color={WORLD_COLORS.snow} roughness={0.42} metalness={0.05} />
      </mesh>

      {/* 中央结构占位：三屿各异（塔盘 / 观测环 / 生态穹），阶段 2 精修 */}
      <IsleStructure slug={isle.slug} accent={isle.accentColor} />

      {/* 主题色弱光（§3.3：每屿 1 点光 intensity ≤8） */}
      <pointLight color={isle.accentColor} intensity={5} distance={20} decay={2} position={[0, 6, 0]} />

      {/* 名牌（drei Html → DOM 层，系统字体栈；pointer-events 关闭，交互阶段 2 接管） */}
      <Html position={[0, 9.2, 0]} center distanceFactor={16} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="world-nameplate">
          <span className="world-nameplate__name">{project?.name ?? isle.name}</span>
          {project ? (
            <span
              className={
                project.status === "已上线"
                  ? "world-nameplate__status world-nameplate__status--live"
                  : "world-nameplate__status"
              }
            >
              {project.status}
            </span>
          ) : null}
        </div>
      </Html>
    </group>
  );
}

/** 三屿中央结构占位体量（简单体量，先构图后细化） */
function IsleStructure({ slug, accent }: { slug: string; accent: string }) {
  if (slug === "agehaos") {
    // 悬浮终端塔雏形：三层玻璃圆盘 + 中央水晶内核（呼应 OS Core）
    return (
      <group>
        {[2.4, 1.9, 1.4].map((radius, i) => (
          <mesh key={radius} position={[0, 1.8 + i * 1.9, 0]} castShadow>
            <cylinderGeometry args={[radius, radius, 0.22, 28]} />
            <meshStandardMaterial color={WORLD_COLORS.glass} transparent opacity={0.62} roughness={0.25} metalness={0.1} />
          </mesh>
        ))}
        <mesh position={[0, 7.4, 0]} castShadow>
          <octahedronGeometry args={[1.15, 0]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.5}
            roughness={0.3}
            flatShading
          />
        </mesh>
        {/* 塔骨柱 */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 2.1, 3.2, Math.sin(angle) * 2.1]}
              castShadow
            >
              <boxGeometry args={[0.16, 6.2, 0.16]} />
              <meshStandardMaterial color={WORLD_COLORS.rockDeep} metalness={0.9} roughness={0.3} />
            </mesh>
          );
        })}
      </group>
    );
  }
  if (slug === "cs-skin-invest") {
    // 行情观测环雏形：立式大环 + 环心悬浮晶片（呼应观测 / 行情）
    return (
      <group>
        <mesh position={[0, 4.2, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[3.1, 0.34, 12, 40]} />
          <meshStandardMaterial color={accent} metalness={0.55} roughness={0.35} />
        </mesh>
        <mesh position={[0, 4.2, 0]} castShadow>
          <boxGeometry args={[1.5, 1.5, 0.18]} />
          <meshStandardMaterial
            color={WORLD_COLORS.glass}
            emissive={accent}
            emissiveIntensity={0.28}
            transparent
            opacity={0.85}
            roughness={0.2}
          />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 4.4, 0.6, Math.sin(angle) * 4.4]}
              castShadow
            >
              <cylinderGeometry args={[0.12, 0.16, 1.2, 8]} />
              <meshStandardMaterial color={WORLD_COLORS.rockDeep} metalness={0.9} roughness={0.3} />
            </mesh>
          );
        })}
      </group>
    );
  }
  // moss-world：生态穹舱雏形：玻璃半穹 + 苔藓丘（全场景唯一「温暖绿意」）
  return (
    <group>
      <mesh position={[0, 0.15, 0]} castShadow>
        <sphereGeometry args={[4.3, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={WORLD_COLORS.glass}
          transparent
          opacity={0.42}
          roughness={0.15}
          metalness={0.05}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.1, 0]} scale={[1, 0.5, 1]} receiveShadow>
        <sphereGeometry args={[3.4, 20, 14]} />
        <meshStandardMaterial color={WORLD_COLORS.mossGreen} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial color={WORLD_COLORS.mossDeep} emissive={WORLD_COLORS.mossGreen} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}
