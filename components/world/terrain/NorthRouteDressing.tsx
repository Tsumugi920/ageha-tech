"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PointLight,
  RingGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
} from "three";
import {
  NORTH_RELAY,
  TRAILS,
  mainIslandSurfaceY,
  type Vec3,
} from "@/lib/world/layout";
import { relayPhase } from "@/lib/world/relayModel";
import { DeepMetalMaterial } from "./materials";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import { useWorldAudio } from "../systems/WorldAudio";
import { inputState } from "../systems/inputState";
import { useWorldUI } from "../WorldUIContext";
import type { PlayerApi } from "../systems/usePlayerController";

/**
 * 北径样板段的空间节奏（P1 §6.3）：
 *
 * - 三段深蓝门柱 + 一道横梁，把 52m 的长桥分成有目的的接近段；
 * - 桥下冰撑让「一条悬空细线」变成有结构厚度的路径；
 * - 径面嵌入 14 个低亮度脉冲节点；靠近信标出现“点亮北径”提示，
 *   E / 点击触发后一条暖色光波通向 AgehaOS，并保持点亮 9s 后复位。
 *
 * 只服务北径（trail-a）与出生区 → AgehaOS 的样板动线，不改其他区域。
 * 全部装饰位于可行走带之外；横梁高于角色，不参与碰撞。
 */

const TRAIL = TRAILS[0];
const PYLON_FRACTIONS = [0.2, 0.5, 0.8] as const;
const PYLON_OFFSET = 2.65;
const PYLON_HEIGHT = 2.7;
const NODE_COUNT = 14;
const NEAR_RADIUS = 10;
const NODE_STEP = 0.14;
const NODE_WINDOW = 0.34;

type PylonSpot = {
  x: number;
  z: number;
  groundY: number;
  facing: number;
  accent: string;
  fraction: number;
};

type NodeSpot = { x: number; y: number; z: number };

function sampleAtFraction(fraction: number): Vec3 {
  const index = Math.max(
    0,
    Math.min(TRAIL.samples.length - 1, Math.round(fraction * (TRAIL.samples.length - 1))),
  );
  return TRAIL.samples[index];
}

function pointOnTrail(progress: number, target: { x: number; y: number; z: number }): void {
  const clamped = Math.max(0, Math.min(1, progress));
  const raw = clamped * (TRAIL.samples.length - 1);
  const i0 = Math.floor(raw);
  const i1 = Math.min(TRAIL.samples.length - 1, i0 + 1);
  const t = raw - i0;
  const a = TRAIL.samples[i0];
  const b = TRAIL.samples[i1];
  target.x = a.x + (b.x - a.x) * t;
  target.y = a.y + (b.y - a.y) * t;
  target.z = a.z + (b.z - a.z) * t;
}

function tangentAtFraction(fraction: number): { x: number; z: number } {
  const s = sampleAtFraction(fraction);
  const index = TRAIL.samples.indexOf(s);
  const prev = TRAIL.samples[Math.max(0, index - 1)];
  const next = TRAIL.samples[Math.min(TRAIL.samples.length - 1, index + 1)];
  const dx = next.x - prev.x;
  const dz = next.z - prev.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

function buildPylons(): PylonSpot[] {
  return PYLON_FRACTIONS.flatMap((fraction, index) => {
    const s = sampleAtFraction(fraction);
    const tangent = tangentAtFraction(fraction);
    const nx = tangent.z;
    const nz = -tangent.x;
    return [-1, 1].map((side) => ({
      x: s.x + nx * PYLON_OFFSET * side,
      z: s.z + nz * PYLON_OFFSET * side,
      groundY: s.y + 0.06,
      facing: Math.atan2(tangent.x, tangent.z),
      accent: index === 1 ? "#A8EEFF" : "#FFD9A0",
      fraction,
    }));
  });
}

function buildNodes(): NodeSpot[] {
  return Array.from({ length: NODE_COUNT }, (_, i) => {
    const fraction = 0.08 + (i / (NODE_COUNT - 1)) * 0.84;
    const s = sampleAtFraction(fraction);
    return { x: s.x, y: s.y + 0.085, z: s.z };
  });
}

function buildSupports(): { x: number; y: number; z: number; scale: number; angle: number }[] {
  return [0.3, 0.56, 0.82].flatMap((fraction) => {
    const s = sampleAtFraction(fraction);
    const tangent = tangentAtFraction(fraction);
    const nx = tangent.z;
    const nz = -tangent.x;
    return [-1, 0, 1].map((side, index) => ({
      x: s.x + nx * (side * 1.15 + (index - 1) * 0.2),
      y: s.y - 2.3 - Math.abs(side) * 0.7,
      z: s.z + nz * (side * 1.15 + (index - 1) * 0.2),
      scale: 0.55 + (index % 2) * 0.25 + Math.abs(side) * 0.12,
      angle: 0.35 + index * 0.6,
    }));
  });
}

const NODE_BASE = new Color("#4F86A9");
const NODE_PULSE = new Color("#FFC27A");

export function NorthRouteDressing({ player }: { player: PlayerApi }) {
  const reducedMotion = usePrefersReducedMotion();
  const audio = useWorldAudio();
  const { activateRelay, recordExploreGoal } = useWorldUI();
  const pylons = useMemo(() => buildPylons(), []);
  const nodes = useMemo(() => buildNodes(), []);
  const supports = useMemo(() => buildSupports(), []);
  const trailStart = TRAIL.samples[0];

  const postRef = useRef<InstancedMesh>(null);
  const baseRef = useRef<InstancedMesh>(null);
  const capRef = useRef<InstancedMesh>(null);
  const nodeRef = useRef<InstancedMesh>(null);
  const shardRef = useRef<InstancedMesh>(null);
  const shardCapRef = useRef<InstancedMesh>(null);
  const triggerRingRef = useRef<Mesh>(null);
  const burstRingRef = useRef<Mesh>(null);
  const burstMatRef = useRef<MeshBasicMaterial>(null);
  const waveLightRef = useRef<PointLight>(null);
  const waveOrbRef = useRef<Mesh>(null);
  const waveOrbMatRef = useRef<MeshBasicMaterial>(null);
  const waveSpriteRef = useRef<Sprite>(null);
  const waveSpriteMatRef = useRef<SpriteMaterial>(null);
  const nodeMatRef = useRef<MeshBasicMaterial>(null);
  const triggerMatRef = useRef<MeshBasicMaterial>(null);
  const triggerCrystalRef = useRef<Mesh>(null);
  const triggerCrystalMatRef = useRef<MeshStandardMaterial>(null);
  const beaconGroupRef = useRef<Group>(null);

  const dummy = useMemo(() => new Object3D(), []);
  const nodeColor = useMemo(() => new Color(), []);
  const capColor = useMemo(() => new Color(), []);
  const wavePoint = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
  const capBaseColors = useMemo(() => pylons.map((pylon) => new Color(pylon.accent)), [pylons]);
  const lastRelayToken = useRef(inputState.relayToken);
  const pulseStart = useRef(-999);
  const pulseLive = useRef(false);
  const debugRef = useRef({ distance: Infinity, since: -999, active: false, triggers: 0, phase: "idle" as string });

  const postGeometry = useMemo(() => new CylinderGeometry(0.075, 0.15, PYLON_HEIGHT, 6), []);
  const baseGeometry = useMemo(() => new CylinderGeometry(0.3, 0.42, 0.24, 6), []);
  const capGeometry = useMemo(() => new OctahedronGeometry(0.18, 0), []);
  const nodeGeometry = useMemo(
    () => new RingGeometry(0.12, 0.24, 20).rotateX(-Math.PI / 2),
    [],
  );
  const shardGeometry = useMemo(() => new OctahedronGeometry(1, 0), []);
  const shardCapGeometry = useMemo(() => new CircleGeometry(0.3, 8), []);
  const ringGeometry = useMemo(() => new RingGeometry(1.05, 1.25, 48), []);
  const waveGlowTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
      gradient.addColorStop(0, "rgba(255, 236, 200, 0.95)");
      gradient.addColorStop(0.32, "rgba(255, 205, 140, 0.45)");
      gradient.addColorStop(1, "rgba(255, 183, 107, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);

  // 开发态脉冲探针：验收脚本读取触发次数 / 节点颜色，不进入生产。
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const read = () => {
      const colors: string[] = [];
      const color = new Color();
      if (nodeRef.current) {
        for (let i = 0; i < NODE_COUNT; i += 1) {
          nodeRef.current.getColorAt(i, color);
          colors.push(color.getHexString());
        }
      }
      return { ...debugRef.current, nodeColors: colors };
    };
    (window as unknown as { __AGEHA_NORTH_STATE__?: () => unknown }).__AGEHA_NORTH_STATE__ = read;
    return () => {
      delete (window as unknown as { __AGEHA_NORTH_STATE__?: () => unknown }).__AGEHA_NORTH_STATE__;
    };
  }, []);

  useEffect(
    () => () => {
      postGeometry.dispose();
      baseGeometry.dispose();
      capGeometry.dispose();
      nodeGeometry.dispose();
      shardGeometry.dispose();
      shardCapGeometry.dispose();
      ringGeometry.dispose();
      waveGlowTexture.dispose();
    },
    [
      postGeometry,
      baseGeometry,
      capGeometry,
      nodeGeometry,
      shardGeometry,
      shardCapGeometry,
      ringGeometry,
      waveGlowTexture,
    ],
  );

  useLayoutEffect(() => {
    const accent = new Color();
    pylons.forEach((pylon, i) => {
      dummy.position.set(pylon.x, pylon.groundY + PYLON_HEIGHT / 2, pylon.z);
      dummy.rotation.set(0, pylon.facing, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(pylon.x, pylon.groundY + 0.12, pylon.z);
      dummy.updateMatrix();
      baseRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(pylon.x, pylon.groundY + PYLON_HEIGHT + 0.16, pylon.z);
      dummy.rotation.set(0, pylon.facing + 0.3, 0);
      dummy.updateMatrix();
      capRef.current?.setMatrixAt(i, dummy.matrix);
      capRef.current?.setColorAt(i, accent.set(pylon.accent));
    });

    nodes.forEach((node, i) => {
      dummy.position.set(node.x, node.y, node.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.8);
      dummy.updateMatrix();
      nodeRef.current?.setMatrixAt(i, dummy.matrix);
      nodeRef.current?.setColorAt(i, NODE_BASE);
    });

    supports.forEach((support, i) => {
      dummy.position.set(support.x, support.y, support.z);
      dummy.rotation.set(support.angle, support.angle * 0.7, support.angle * 0.3);
      dummy.scale.set(support.scale, support.scale * 1.8, support.scale);
      dummy.updateMatrix();
      shardRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(support.x, support.y + support.scale * 1.65, support.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(support.scale, support.scale, 1);
      dummy.updateMatrix();
      shardCapRef.current?.setMatrixAt(i, dummy.matrix);
    });

    [
      postRef.current,
      baseRef.current,
      capRef.current,
      nodeRef.current,
      shardRef.current,
      shardCapRef.current,
    ].forEach((mesh) => {
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    if (beaconGroupRef.current) {
      const y = mainIslandSurfaceY(NORTH_RELAY.x, NORTH_RELAY.z);
      beaconGroupRef.current.position.set(NORTH_RELAY.x, y, NORTH_RELAY.z);
    }
  }, [dummy, nodes, pylons, supports, trailStart]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = player.pos.current;
    const distance = Math.hypot(p.x - trailStart.x, p.z - trailStart.z);
    const near = distance < NEAR_RADIUS;

    // 明确操作：E / HUD 提示条 / 场景点击写入 relayToken，靠近范围才生效
    if (inputState.relayToken !== lastRelayToken.current) {
      lastRelayToken.current = inputState.relayToken;
      if (distance < NEAR_RADIUS) {
        pulseStart.current = t;
        pulseLive.current = true;
        debugRef.current.triggers += 1;
        audio.playRelay();
        // P4：信标被真正接受（玩家在径头范围内）才记录探索目标
        recordExploreGoal("north-relay");
      }
    }

    const since = t - pulseStart.current;
    const phase = relayPhase(since);
    const pulsing = phase === "pulse";
    const lit = phase === "pulse" || phase === "lit";
    debugRef.current.distance = distance;
    debugRef.current.since = since;
    debugRef.current.active = lit;
    debugRef.current.phase = phase;

    // 信标：靠近时稳定发亮，点亮期间保持暖色
    const beaconHot = near || lit;
    if (triggerMatRef.current) {
      triggerMatRef.current.opacity = beaconHot ? 0.55 : 0.2;
    }
    if (triggerRingRef.current) {
      const breathe = beaconHot && !reducedMotion ? 1 + Math.sin(t * 4) * 0.05 : 1;
      triggerRingRef.current.scale.setScalar(breathe);
    }
    if (triggerCrystalMatRef.current) {
      triggerCrystalMatRef.current.emissiveIntensity = beaconHot ? 1.7 : 0.55;
    }
    if (triggerCrystalRef.current && !reducedMotion) {
      triggerCrystalRef.current.rotation.y = t * (beaconHot ? 1.1 : 0.35);
    }
    if (burstMatRef.current && burstRingRef.current) {
      if (since >= 0 && since < 1.2) {
        if (reducedMotion) {
          burstMatRef.current.opacity = 0.32;
          burstRingRef.current.scale.setScalar(1.8);
        } else {
          const burst = since / 1.2;
          burstMatRef.current.opacity = 0.62 * (1 - burst);
          burstRingRef.current.scale.setScalar(0.7 + burst * 2.8);
        }
      } else {
        burstMatRef.current.opacity = 0;
      }
    }

    // 行进光波只属于 pulse 阶段；lit 阶段由节点/灯柱保持暖色状态
    const waveOn = pulsing && since >= 0 && !reducedMotion;
    const waveFade = waveOn
      ? Math.min(1, since / 0.2) * Math.max(0, Math.min(1, (2.4 - since) / 0.3))
      : 0;
    if (waveLightRef.current) {
      waveLightRef.current.intensity = waveFade * 5.5;
    }
    if (waveOrbRef.current && waveOrbMatRef.current) {
      pointOnTrail(0.08 + Math.min(1, Math.max(0, since / 2.4)) * 0.84, wavePoint);
      waveOrbRef.current.position.set(wavePoint.x, wavePoint.y + 1.05, wavePoint.z);
      waveLightRef.current?.position.set(wavePoint.x, wavePoint.y + 1.05, wavePoint.z);
      waveOrbMatRef.current.opacity = waveFade * 0.85;
      if (waveSpriteRef.current) {
        waveSpriteRef.current.position.set(wavePoint.x, wavePoint.y + 1.05, wavePoint.z);
      }
      if (waveSpriteMatRef.current) waveSpriteMatRef.current.opacity = waveFade * 0.95;
    }

    if (nodeMatRef.current) nodeMatRef.current.opacity = lit ? 0.92 : 0.5;

    if (pulsing) {
      pylons.forEach((pylon, i) => {
        const delay =
          ((pylon.fraction - 0.08) / 0.84) * (NODE_COUNT - 1) * NODE_STEP;
        const local = since - delay;
        const flare = reducedMotion
          ? 1
          : local > 0 && local < NODE_WINDOW
            ? Math.sin((local / NODE_WINDOW) * Math.PI)
            : 0;
        capColor.copy(capBaseColors[i]).lerp(NODE_PULSE, flare);
        capRef.current?.setColorAt(i, capColor);
        dummy.position.set(
          pylon.x,
          pylon.groundY + PYLON_HEIGHT + 0.16,
          pylon.z,
        );
        dummy.rotation.set(0, pylon.facing + 0.3, 0);
        dummy.scale.setScalar(1 + flare * 0.55);
        dummy.updateMatrix();
        capRef.current?.setMatrixAt(i, dummy.matrix);
      });
      if (capRef.current) {
        capRef.current.instanceMatrix.needsUpdate = true;
        if (capRef.current.instanceColor) capRef.current.instanceColor.needsUpdate = true;
      }
      nodes.forEach((node, i) => {
        const local = since - i * NODE_STEP;
        const flare = reducedMotion
          ? 1
          : local > 0 && local < NODE_WINDOW
            ? Math.sin((local / NODE_WINDOW) * Math.PI)
            : 0;
        nodeColor.copy(NODE_BASE).lerp(NODE_PULSE, flare);
        nodeRef.current?.setColorAt(i, nodeColor);
        dummy.position.set(node.x, node.y, node.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.8 + flare * 0.75);
        dummy.updateMatrix();
        nodeRef.current?.setMatrixAt(i, dummy.matrix);
      });
      if (nodeRef.current) {
        nodeRef.current.instanceMatrix.needsUpdate = true;
        if (nodeRef.current.instanceColor) nodeRef.current.instanceColor.needsUpdate = true;
      }
      pulseLive.current = true;
    } else if (phase === "lit") {
      // 光波结束后保持“已点亮”：节点与灯头全部转为暖色
      pylons.forEach((pylon, i) => {
        capRef.current?.setColorAt(i, NODE_PULSE);
        dummy.position.set(
          pylon.x,
          pylon.groundY + PYLON_HEIGHT + 0.16,
          pylon.z,
        );
        dummy.rotation.set(0, pylon.facing + 0.3, 0);
        dummy.scale.setScalar(1.15);
        dummy.updateMatrix();
        capRef.current?.setMatrixAt(i, dummy.matrix);
      });
      if (capRef.current) {
        capRef.current.instanceMatrix.needsUpdate = true;
        if (capRef.current.instanceColor) capRef.current.instanceColor.needsUpdate = true;
      }
      nodes.forEach((node, i) => {
        nodeRef.current?.setColorAt(i, NODE_PULSE);
        dummy.position.set(node.x, node.y, node.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.95);
        dummy.updateMatrix();
        nodeRef.current?.setMatrixAt(i, dummy.matrix);
      });
      if (nodeRef.current) {
        nodeRef.current.instanceMatrix.needsUpdate = true;
        if (nodeRef.current.instanceColor) nodeRef.current.instanceColor.needsUpdate = true;
      }
      pulseLive.current = true;
    } else if (pulseLive.current) {
      pylons.forEach((pylon, i) => {
        capRef.current?.setColorAt(i, capBaseColors[i]);
        dummy.position.set(
          pylon.x,
          pylon.groundY + PYLON_HEIGHT + 0.16,
          pylon.z,
        );
        dummy.rotation.set(0, pylon.facing + 0.3, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        capRef.current?.setMatrixAt(i, dummy.matrix);
      });
      if (capRef.current) {
        capRef.current.instanceMatrix.needsUpdate = true;
        if (capRef.current.instanceColor) capRef.current.instanceColor.needsUpdate = true;
      }
      nodes.forEach((node, i) => {
        nodeRef.current?.setColorAt(i, NODE_BASE);
        dummy.position.set(node.x, node.y, node.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.8);
        dummy.updateMatrix();
        nodeRef.current?.setMatrixAt(i, dummy.matrix);
      });
      if (nodeRef.current) {
        nodeRef.current.instanceMatrix.needsUpdate = true;
        if (nodeRef.current.instanceColor) nodeRef.current.instanceColor.needsUpdate = true;
      }
      pulseLive.current = false;
    }
  });

  return (
    <group name="north-route-dressing">
      {/* 三段门柱：深蓝金属基座 + 暖/冷灯头 */}
      <instancedMesh ref={postRef} args={[postGeometry, undefined, pylons.length]} castShadow>
        <meshStandardMaterial color="#274E6E" metalness={0.72} roughness={0.32} />
      </instancedMesh>
      <instancedMesh ref={baseRef} args={[baseGeometry, undefined, pylons.length]} castShadow receiveShadow>
        <meshStandardMaterial color="#355D7D" roughness={0.62} metalness={0.2} flatShading />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[capGeometry, undefined, pylons.length]}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* 中段横梁：低亮度结构线，不遮挡通行 */}
      {(() => {
        const s = sampleAtFraction(0.5);
        const tangent = tangentAtFraction(0.5);
        return (
          <group
            position={[s.x, s.y + PYLON_HEIGHT + 0.02, s.z]}
            rotation={[0, Math.atan2(tangent.x, tangent.z), 0]}
          >
            <mesh castShadow>
              <boxGeometry args={[PYLON_OFFSET * 2 + 0.3, 0.09, 0.12]} />
              <DeepMetalMaterial color="#2B5476" roughness={0.34} />
            </mesh>
            <mesh position={[0, -0.075, 0]}>
              <boxGeometry args={[PYLON_OFFSET * 2 - 0.4, 0.012, 0.03]} />
              <meshBasicMaterial color="#FFD9A0" transparent opacity={0.5} toneMapped={false} />
            </mesh>
          </group>
        );
      })()}

      {/* 桥面嵌入脉冲节点：静态是暗蓝导引，触发后暖色光波通向终点 */}
      <instancedMesh
        ref={nodeRef}
        args={[nodeGeometry, undefined, nodes.length]}
        renderOrder={2}
      >
        <meshBasicMaterial
          ref={nodeMatRef}
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* 桥下冰撑：给悬空长桥结构厚度 */}
      <instancedMesh ref={shardRef} args={[shardGeometry, undefined, supports.length]} castShadow>
        <meshStandardMaterial color="#3A6488" roughness={0.78} metalness={0.08} flatShading />
      </instancedMesh>
      <instancedMesh ref={shardCapRef} args={[shardCapGeometry, undefined, supports.length]}>
        <meshBasicMaterial color="#B8EFFF" transparent opacity={0.55} depthWrite={false} />
      </instancedMesh>

      {/* 沿北径行进的暖光：触发后从径头一路点亮到 AgehaOS */}
      <pointLight ref={waveLightRef} color="#FFD9A0" intensity={0} distance={9} decay={2} />
      <mesh ref={waveOrbRef}>
        <sphereGeometry args={[0.24, 12, 8]} />
        <meshBasicMaterial
          ref={waveOrbMatRef}
          color="#FFD9A0"
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <sprite ref={waveSpriteRef} scale={[2.2, 2.2, 1]}>
        <spriteMaterial
          ref={waveSpriteMatRef}
          map={waveGlowTexture}
          color="#FFD9A0"
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      {/* 径头触发信标：玩家进入 8m 即点亮北径，离开 13m 后可再次触发 */}
      <group ref={beaconGroupRef}>
        <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.5, 0.65, 0.32, 6]} />
          <meshStandardMaterial color="#365D7C" roughness={0.55} metalness={0.24} flatShading />
        </mesh>
        <mesh ref={triggerCrystalRef} position={[0, 0.62, 0]} castShadow>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial
            ref={triggerCrystalMatRef}
            color="#FFF0D2"
            emissive="#FFB36B"
            emissiveIntensity={0.55}
            roughness={0.24}
            flatShading
          />
        </mesh>
        <mesh ref={triggerRingRef} geometry={ringGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
          <meshBasicMaterial
            ref={triggerMatRef}
            color="#FFD9A0"
            transparent
            opacity={0.2}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {/* 场景点击热区：与 HUD 提示条同一条操作路径 */}
        <mesh
          position={[0, 0.72, 0]}
          onClick={(event) => {
            event.stopPropagation();
            if (!inputState.pointerDragged) activateRelay();
          }}
        >
          <sphereGeometry args={[0.8, 12, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh ref={burstRingRef} geometry={ringGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
          <meshBasicMaterial
            ref={burstMatRef}
            color="#FFD9A0"
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
