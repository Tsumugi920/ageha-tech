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
  offset = 0,
  heightAt?: (x: number, z: number) => number,
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
    // 侧向单位向量 = 切线 × 上；offset 平移整条丝带（用于道路双缘线），
    // 不参与宽度计算——R9 前 offset 被加到半宽上，边线会变成整幅宽色带。
    const nx = tz;
    const nz = -tx;
    const s = samples[i];
    const leftX = s.x + nx * (offset - width / 2);
    const leftZ = s.z + nz * (offset - width / 2);
    const rightX = s.x + nx * (offset + width / 2);
    const rightZ = s.z + nz * (offset + width / 2);
    // heightAt：让丝带两侧各自贴合横坡（接近广场的铺装不再悬空 / 切雪）
    positions[i * 6] = leftX;
    positions[i * 6 + 1] = (heightAt ? heightAt(leftX, leftZ) : s.y) + yOffset;
    positions[i * 6 + 2] = leftZ;
    positions[i * 6 + 3] = rightX;
    positions[i * 6 + 4] = (heightAt ? heightAt(rightX, rightZ) : s.y) + yOffset;
    positions[i * 6 + 5] = rightZ;
    if (i < count - 1) {
      const a = i * 2;
      // 逆时针绕序使法线朝上（原绕序朝下，贴地薄面会被自身阴影压暗）
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
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
