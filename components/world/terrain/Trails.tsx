"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { TRAILS } from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import { buildRibbonGeometry } from "./ribbonGeometry";

/**
 * 鳞粉蝶径（蓝图 §2.3 / 阶段 1 雏形：几何光带 + 悬浮石板段，零纹理）。
 * 石板用 InstancedMesh（重复物体实例化渲染），光带为双层丝带几何
 * （宽幅微光 + 中心亮线），全部程序化生成、卸载时 dispose。
 */

const SLAB_STRIDE = 3;
const SLAB_SCALE = new Vector3(2.6, 0.16, 1.7);
const UP_AXIS = new Vector3(0, 1, 0);

export function Trails() {
  const ribbons = useMemo(
    () =>
      TRAILS.map((trail) => ({
        band: buildRibbonGeometry(trail.samples, trail.width * 1.15, -0.26),
        line: buildRibbonGeometry(trail.samples, 0.7, -0.24),
      })),
    [],
  );
  const slabCount = useMemo(
    () =>
      TRAILS.reduce(
        (sum, trail) => sum + Math.floor(trail.samples.length / SLAB_STRIDE),
        0,
      ),
    [],
  );
  const slabGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);

  useEffect(
    () => () => {
      ribbons.forEach((r) => [r.band.dispose(), r.line.dispose()]);
      slabGeometry.dispose();
    },
    [ribbons, slabGeometry],
  );

  const slabRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = slabRef.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    let index = 0;
    for (const trail of TRAILS) {
      for (let i = 1; i < trail.samples.length && index < slabCount; i += SLAB_STRIDE) {
        const s = trail.samples[i];
        const prev = trail.samples[i - 1];
        quaternion.setFromAxisAngle(
          UP_AXIS,
          Math.atan2(s.x - prev.x, s.z - prev.z),
        );
        position.set(s.x, s.y - 0.085, s.z);
        matrix.compose(position, quaternion, SLAB_SCALE);
        mesh.setMatrixAt(index, matrix);
        index += 1;
      }
    }
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
  }, [slabCount]);

  return (
    <group>
      {TRAILS.map((trail, i) => (
        <group key={trail.id}>
          {/* 宽幅微光带（阶段 3 实测调校：0.16 在初始构图里读不出径向，
              提到 0.22——仍克制，不与蝶枢抢焦点） */}
          <mesh geometry={ribbons[i].band}>
            <meshBasicMaterial
              color={WORLD_COLORS.trailGlow}
              transparent
              opacity={0.22}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
          {/* 中心亮线（加法混合模拟辉光，无后处理） */}
          <mesh geometry={ribbons[i].line}>
            <meshBasicMaterial
              color={WORLD_COLORS.trailGlow}
              transparent
              opacity={0.6}
              depthWrite={false}
              blending={AdditiveBlending}
              side={DoubleSide}
            />
          </mesh>
        </group>
      ))}
      {/* 悬浮石板段（可行走面 = 数据层蝶径带；石板为视觉体量） */}
      <instancedMesh
        ref={slabRef}
        args={[slabGeometry, undefined, slabCount]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#E8F3FD" roughness={0.75} />
      </instancedMesh>
    </group>
  );
}
