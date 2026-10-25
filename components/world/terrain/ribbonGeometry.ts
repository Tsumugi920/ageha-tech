import { BufferAttribute, BufferGeometry } from "three";

/**
 * 丝带几何工具（蝶径光带 / 旋径暗带共用）：
 * 沿采样折线生成等宽双层丝带（宽幅微光 + 中心亮线由两次调用产出）。
 * 纯几何工具（客户端组件树内使用），卸载由调用方 dispose。
 */
export function buildRibbonGeometry(
  samples: ReadonlyArray<{ x: number; y: number; z: number }>,
  width: number,
  yOffset: number,
): BufferGeometry {
  const count = samples.length;
  const positions = new Float32Array(count * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(count - 1, i + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    // 侧向 = 切线 × 上
    const sx = tz * (width / 2);
    const sz = -tx * (width / 2);
    const s = samples[i];
    positions[i * 6] = s.x - sx;
    positions[i * 6 + 1] = s.y + yOffset;
    positions[i * 6 + 2] = s.z - sz;
    positions[i * 6 + 3] = s.x + sx;
    positions[i * 6 + 4] = s.y + yOffset;
    positions[i * 6 + 5] = s.z + sz;
    if (i < count - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}
