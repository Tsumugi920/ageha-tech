import { BufferAttribute, BufferGeometry, Color } from "three";

/**
 * 丝带几何工具（蝶径光带 / 旋径暗带共用）：
 * 沿采样折线生成等宽双层丝带（宽幅微光 + 中心亮线由两次调用产出）。
 * 纯几何工具（客户端组件树内使用），卸载由调用方 dispose。
 */
export function buildRibbonGeometry(
  samples: ReadonlyArray<{ x: number; y: number; z: number }>,
  width: number,
  yOffset: number,
  offset = 0,
  heightAt?: (x: number, z: number) => number,
  acrossSegments = 1,
): BufferGeometry {
  const count = samples.length;
  const stride = acrossSegments + 1;
  const positions = new Float32Array(count * stride * 3);
  const indices: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(count - 1, i + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    // 侧向单位向量 = 切线 × 上；offset 平移整条丝带（用于道路双缘线），
    // 不参与宽度计算——R9 前 offset 被加到半宽上，边线会变成整幅宽色带。
    const nx = tz;
    const nz = -tx;
    const s = samples[i];
    // 默认仍为左右两列；北径试点额外采样横坡，避免跨过凹地的直线弦悬空。
    for (let j = 0; j <= acrossSegments; j += 1) {
      const lateral = offset + width * (j / acrossSegments - 0.5);
      const x = s.x + nx * lateral;
      const z = s.z + nz * lateral;
      const index = (i * stride + j) * 3;
      positions[index] = x;
      positions[index + 1] = (heightAt ? heightAt(x, z) : s.y) + yOffset;
      positions[index + 2] = z;
      if (i < count - 1 && j < acrossSegments) {
        const a = i * stride + j;
        // 逆时针绕序保持法线朝上。
        indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  // 丝带是贴地薄面：补一次法线计算，标准材质才能按坡面正确受光。
  // （R9 前缺失 normal 属性，接近铺装在平地上会呈现不受光的深色块。）
  geometry.computeVertexNormals();
  return geometry;
}

/** 北径接近铺装的路缘积雪色：保留几何，外侧更浅，两端恢复原石色。 */
export function addApproachSnowColor(geometry: BufferGeometry, outerColumn: 0 | 1): void {
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  const stone = new Color("#5F82A0");
  const snow = new Color("#D5E6F1");
  const color = new Color();
  const smooth = (a: number, b: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < count; i += 1) {
    const t = Math.floor(i / 2) / (count / 2 - 1);
    const cover = smooth(0.1, 0.3, t) * (1 - smooth(0.8, 0.98, t));
    color.copy(stone).lerp(snow, cover * (i % 2 === outerColumn ? 0.85 : 0.18));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}
