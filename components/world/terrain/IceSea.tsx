"use client";

import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  InstancedMesh,
  MirroredRepeatWrapping,
  Object3D,
  SRGBColorSpace,
} from "three";
import { WORLD_COLORS } from "@/lib/world/constants";
import { WORLD_SCALE } from "@/lib/world";

/**
 * 冰海（R3 重做）：程序化冰海水纹 + 环绕浮冰群。
 *
 * R2 的纯色大平面在低空视角下会读成「一大片空白」——这正是验收截图里
 * 灰色空白的来源之一。新版用 canvas 生成冰纹 / 裂缝纹理（零外部资源），
 * 再补一圈低对比浮冰，让海面有尺度与层次，同时在雾中自然衰减。
 */
const FLOE_COUNT = 18;

export function IceSea() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const base = ctx.createLinearGradient(0, 0, 512, 512);
      base.addColorStop(0, "#BEE2F6");
      base.addColorStop(0.5, WORLD_COLORS.sea);
      base.addColorStop(1, "#A9D6EE");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 512, 512);
      // 冰面斑块（确定性伪随机，避免每次刷新差异）
      for (let i = 0; i < 90; i += 1) {
        const x = ((i * 137) % 512) + ((i * 53) % 40);
        const y = ((i * 271) % 512) + ((i * 89) % 40);
        const r = 18 + ((i * 37) % 46);
        const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
        const alpha = 0.1 + ((i * 19) % 10) / 90;
        grad.addColorStop(0, `rgba(240,251,255,${alpha})`);
        grad.addColorStop(0.7, `rgba(214,238,252,${alpha * 0.6})`);
        grad.addColorStop(1, "rgba(214,238,252,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // 冰裂缝：细长折线
      ctx.strokeStyle = "rgba(126,180,215,0.5)";
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 26; i += 1) {
        const x = (i * 97) % 512;
        const y = (i * 163) % 512;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 40 + ((i * 29) % 60), y + 16 + ((i * 11) % 40));
        ctx.lineTo(x + 80 + ((i * 17) % 50), y + 4 + ((i * 23) % 30));
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 18; i += 1) {
        const x = (i * 211) % 512;
        const y = (i * 71) % 512;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 70 + ((i * 13) % 40), y - 24 - ((i * 7) % 30));
        ctx.stroke();
      }
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    // R12.0-D（G2）：Repeat → MirroredRepeat——canvas 渐变底色与
    // 斑块 / 裂缝在重复边界被硬切断，2000m 海面上每 77m 一条可读
    // 直线缝（大方格）；镜像平铺让边界自然对称延续，接缝消失
    map.wrapS = MirroredRepeatWrapping;
    map.wrapT = MirroredRepeatWrapping;
    map.repeat.set(26, 26);
    map.anisotropy = 8;
    return map;
  }, []);

  const floeRef = useMemo(() => new Object3D(), []);
  const floes = useMemo(
    () =>
      Array.from({ length: FLOE_COUNT }, (_, i) => {
        const angle = i * 2.399963 + 0.8;
        const radius = 62 + ((i * 47) % 100) * 1.15;
        const scale = 3.4 + ((i * 31) % 10) * 1.5;
        return {
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          y: WORLD_SCALE.seaLevelY + ((i * 13) % 5) * 0.35,
          scale,
          rot: (i * 1.7) % Math.PI,
        };
      }),
    [],
  );

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD_SCALE.seaLevelY, 0]}>
        <planeGeometry args={[WORLD_SCALE.seaSize, WORLD_SCALE.seaSize, 1, 1]} />
        <meshStandardMaterial
          map={texture}
          color="#DCEEFA"
          roughness={0.42}
          metalness={0.06}
          transparent
          opacity={0.94}
        />
      </mesh>
      {/* 浮冰群：大小不一、略高于水面，给远景海面提供尺度参照 */}
      <instancedMesh
        ref={(node: InstancedMesh | null) => {
          if (!node) return;
          floes.forEach((floe, i) => {
            floeRef.position.set(floe.x, floe.y, floe.z);
            floeRef.rotation.set(0, floe.rot, 0.04 * ((i % 3) - 1));
            floeRef.scale.set(floe.scale, floe.scale * 0.16, floe.scale * (0.7 + ((i * 7) % 5) * 0.08));
            floeRef.updateMatrix();
            node.setMatrixAt(i, floeRef.matrix);
          });
          node.instanceMatrix.needsUpdate = true;
        }}
        args={[undefined, undefined, FLOE_COUNT]}
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#D8EDFA" roughness={0.55} metalness={0.05} flatShading />
      </instancedMesh>
    </group>
  );
}