import { BufferAttribute, BufferGeometry, ConeGeometry, Color, LatheGeometry, Vector2 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * 针叶树形态数据与冠层几何（R12.1-B 抽离自 MainIsland，纯 TS 可测）。
 *
 * R5.1 的三形态只有「层数/宽度」的量级差，轮廓仍是同一套锥叠节奏；
 * R12.1-B 重建为四种轮廓语言（不只是缩放同一模型）：
 *
 * - spire 高耸针叶树：6 层窄锥、层距拉开、总高 ~4.4 单位——修长的
 *   塔形轮廓，适合远景与高处（西岭主簇 / 东北丘原）；
 * - broad 宽冠针叶树：4 层宽锥、层高压扁、底冠 ~2.1 单位宽——舒展的
 *   伞形轮廓，适合主岛中景（池岸 / 林缘）；
 * - wind 风蚀斜冠松：保留 R5.1 的 5 层逐层偏移窄冠（风蚀方向性剪影）；
 * - tuft 小型装饰树：三轮枝缘连成幼松冠、总高 ~1.3 单位——路缘与
 *   局部景观的低矮点缀，不与乔木争轮廓。
 *
 * 同一形态内仍由布点叠加宽 / 高比例、根部倾斜与逐层扭转，避免同形
 * 树只是等比缩放；顶端雪色烘进冠层几何。
 */

export type PineForm = "spire" | "broad" | "wind" | "tuft";

export type PineTier = {
  radius: number;
  height: number;
  y: number;
  dx: number;
  dz: number;
  sides: number;
  color: string;
  /** 各层绕自身轴的旋转，打散同形冠层的棱线对齐 */
  twist?: number;
};

export const PINE_FORMS: Record<PineForm, {
  tiers: readonly PineTier[];
  trunkHeight?: number;
  trunkBase?: number;
  continuousCanopy?: boolean;
}> = {
  // R12.0-C（G11）冠色基调整体提亮向青灰-冰绿；R12.1-B 各形态基色再
  // 拉开半档色相差：spire 偏蓝青、broad 偏灰绿、wind 偏青、tuft 最浅
  spire: {
    tiers: [
      { radius: 0.52, height: 1.5, y: 1.05, dx: 0.02, dz: 0.01, sides: 7, color: "#457788", twist: 0.15 },
      { radius: 0.45, height: 1.32, y: 1.78, dx: -0.03, dz: 0.02, sides: 7, color: "#54879A", twist: 0.55 },
      { radius: 0.37, height: 1.14, y: 2.48, dx: 0.03, dz: -0.01, sides: 6, color: "#679CAB", twist: 0.95 },
      { radius: 0.28, height: 0.94, y: 3.14, dx: -0.02, dz: 0.01, sides: 6, color: "#7CB2BC", twist: 1.2 },
      { radius: 0.19, height: 0.7, y: 3.74, dx: 0.02, dz: -0.01, sides: 5, color: "#9AC8CE", twist: 1.45 },
      { radius: 0.1, height: 0.42, y: 4.22, dx: -0.01, dz: 0.01, sides: 5, color: "#B4DADF", twist: 1.7 },
    ],
  },
  broad: {
    tiers: [
      { radius: 1.04, height: 0.94, y: 0.68, dx: 0.02, dz: 0, sides: 8, color: "#5D8B97", twist: 0.2 },
      { radius: 0.85, height: 0.82, y: 1.26, dx: -0.04, dz: 0.02, sides: 7, color: "#72A2AC", twist: 0.7 },
      { radius: 0.6, height: 0.68, y: 1.82, dx: 0.02, dz: -0.02, sides: 6, color: "#92C0C8", twist: 1.1 },
      { radius: 0.32, height: 0.46, y: 2.3, dx: -0.01, dz: 0.01, sides: 5, color: "#AFD8DC", twist: 1.4 },
    ],
  },
  wind: {
    tiers: [
      { radius: 0.56, height: 1.18, y: 0.94, dx: 0.06, dz: 0.01, sides: 6, color: "#44798B", twist: 0.1 },
      { radius: 0.46, height: 1.0, y: 1.6, dx: 0.13, dz: -0.02, sides: 6, color: "#5794A3", twist: 0.6 },
      { radius: 0.36, height: 0.88, y: 2.18, dx: 0.22, dz: 0.02, sides: 5, color: "#6FACB8", twist: 1.0 },
      { radius: 0.25, height: 0.66, y: 2.72, dx: 0.3, dz: -0.01, sides: 5, color: "#8AC0C8", twist: 1.4 },
      { radius: 0.14, height: 0.42, y: 3.12, dx: 0.36, dz: 0.01, sides: 5, color: "#A0CCD4", twist: 1.7 },
    ],
  },
  tuft: {
    trunkHeight: 0.88,
    trunkBase: -0.08,
    continuousCanopy: true,
    tiers: [
      { radius: 0.42, height: 0.6, y: 0.4, dx: 0.015, dz: 0.01, sides: 7, color: "#6E9AA6", twist: 0.25 },
      { radius: 0.31, height: 0.48, y: 0.76, dx: -0.02, dz: -0.01, sides: 6, color: "#87B4BC", twist: 0.85 },
      { radius: 0.17, height: 0.34, y: 1.08, dx: 0.015, dz: 0.01, sides: 5, color: "#A6CED2", twist: 1.3 },
    ],
  },
};

/**
 * 同一形态的树冠烘成一份几何（顶点色区分层高），单次实例化。
 * R12.0-C（G11）：积雪从「只有顶层」扩到上两层——顶层全强度、
 * 次顶层半强度，中距离树冠也能读出积雪层次。
 */
export function buildPineFoliage(form: (typeof PINE_FORMS)[PineForm]): BufferGeometry {
  const snow = new Color("#EDF8FE");
  if (form.continuousCanopy) {
    // 小树沿原三层的枝肩与枝颈连接表面，避免三顶独立锥帽；不增加枝轮。
    const bottom = form.tiers[0].y - form.tiers[0].height / 2 + 0.08;
    const last = form.tiers[form.tiers.length - 1];
    const top = last.y + last.height / 2;
    const profile = [new Vector2(0, bottom)];
    for (const tier of form.tiers) {
      profile.push(new Vector2(tier.radius, tier.y - tier.height * 0.2));
      profile.push(new Vector2(tier.radius * 0.46, tier.y + tier.height * 0.22));
    }
    profile.push(new Vector2(0, top));
    const geometry = new LatheGeometry(profile, form.tiers[0].sides).toNonIndexed();
    const position = geometry.getAttribute("position");
    const palette = form.tiers.map(tier => new Color(tier.color));
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const t = Math.max(0, Math.min(1, (y - bottom) / (top - bottom)));
      const angle = Math.atan2(z, x), radius = Math.hypot(x, z);
      // 同向枝缘起伏与轻微弯梢；幅度有界，六株沿原旋转呈现不同侧影。
      const spread = 0.93 + 0.07 * Math.cos(3 * angle + y * 0.8);
      position.setXYZ(i, x * spread + 0.015 * t * t, y + 0.015 * Math.sin(2 * angle + 0.4) * radius / form.tiers[0].radius, z * spread - 0.01 * t);
      const level = t * (palette.length - 1), lower = Math.floor(level);
      const color = palette[lower].clone().lerp(palette[Math.min(lower + 1, palette.length - 1)], level - lower);
      const frost = Math.max(0, (t - 0.65) / 0.35);
      color.lerp(snow, frost * frost * (3 - 2 * frost) * 0.82);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
  const parts = form.tiers.map((tier, tierIndex) => {
    const cone = new ConeGeometry(tier.radius, tier.height, tier.sides, 1).toNonIndexed();
    cone.rotateY(tier.twist ?? 0);
    cone.translate(tier.dx, tier.y, tier.dz);
    const base = new Color(tier.color);
    const tierFromTop = form.tiers.length - 1 - tierIndex;
    const frostStrength = tierFromTop === 0 ? 0.82 : tierFromTop === 1 ? 0.4 : 0;
    const count = cone.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      let color = base;
      if (frostStrength > 0) {
        const y = cone.getAttribute("position").getY(i) - tier.y;
        const t = Math.max(0, Math.min(1, y / tier.height + 0.5));
        const frost = t < 0.55 ? 0 : (t - 0.55) / 0.45;
        color = base
          .clone()
          .lerp(snow, frost * frost * (3 - 2 * frost) * frostStrength);
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    cone.setAttribute("color", new BufferAttribute(colors, 3));
    return cone;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("针叶树冠几何合并失败");
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}
