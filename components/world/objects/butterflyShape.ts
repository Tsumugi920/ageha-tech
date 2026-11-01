import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ExtrudeGeometry,
  Shape,
  ShapeGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WORLD_COLORS } from "@/lib/world/constants";

/**
 * 蝴蝶翼 Shape 转换工具（蓝图 §5 / §10 objects/butterflyShape）：
 * `components/layout/ButterflyLogo.tsx:63-88` 四片翼的贝塞尔 path 数据
 * 已一次性手工转换并硬编码于下方四个构造函数（运行时零 SVG 依赖、
 * 零外部资源），坐标变换：x′=(x−24)/48、y′=−(y−23)/48
 * （SVG y 向下 → three Shape y 向上；48 箱体 → 单位翼展）。
 *
 * 水晶渐变按 app/icon.svg 同款三色（#8FE8FF→#269DFF→#9C83FF，
 * 见 WORLD_COLORS.crystal）以顶点色烘进几何——材质只需开 vertexColors，
 * 无需纹理。纯几何工厂（无 JSX / 无 React），几何由调用方 dispose。
 */

/** 原始翼形全展（4.4→43.6 共 39.2 单位 / 48 箱体），翼展缩放基准 */
export const BUTTERFLY_UNIT_SPAN = 39.2 / 48;

const cx = 24;
const cy = 23;
const px = (x: number) => (x - cx) / 48;
const py = (y: number) => -(y - cy) / 48;

/** 上左翼（ButterflyLogo.tsx:63-68 的 path 数据硬编码转换） */
function buildUpperLeft(): Shape {
  const s = new Shape();
  s.moveTo(px(22.6), py(19.6));
  s.bezierCurveTo(px(19.4), py(12.6), px(12.6), py(7.2), px(8.2), py(8.4));
  s.bezierCurveTo(px(4.6), py(9.4), px(4.4), py(14.4), px(7.6), py(18.4));
  s.bezierCurveTo(px(10.6), py(22.2), px(17.4), py(24.2), px(22.6), py(23.2));
  s.closePath();
  return s;
}

/** 上右翼（镜像，ButterflyLogo.tsx:70-75） */
function buildUpperRight(): Shape {
  const s = new Shape();
  s.moveTo(px(25.4), py(19.6));
  s.bezierCurveTo(px(28.6), py(12.6), px(35.4), py(7.2), px(39.8), py(8.4));
  s.bezierCurveTo(px(43.4), py(9.4), px(43.6), py(14.4), px(40.4), py(18.4));
  s.bezierCurveTo(px(37.4), py(22.2), px(30.6), py(24.2), px(25.4), py(23.2));
  s.closePath();
  return s;
}

/** 下左翼（ButterflyLogo.tsx:79-82） */
function buildLowerLeft(): Shape {
  const s = new Shape();
  s.moveTo(px(22.8), py(25.4));
  s.bezierCurveTo(px(18.6), py(25.8), px(13.6), py(27.8), px(12), py(31.2));
  s.bezierCurveTo(px(10.6), py(34.4), px(13), py(37.6), px(16.4), py(36.8));
  s.bezierCurveTo(px(19.8), py(36), px(22.4), py(32.2), px(23.4), py(28.2));
  s.closePath();
  return s;
}

/** 下右翼（镜像，ButterflyLogo.tsx:84-87） */
function buildLowerRight(): Shape {
  const s = new Shape();
  s.moveTo(px(25.2), py(25.4));
  s.bezierCurveTo(px(29.4), py(25.8), px(34.4), py(27.8), px(36), py(31.2));
  s.bezierCurveTo(px(37.4), py(34.4), px(35), py(37.6), px(31.6), py(36.8));
  s.bezierCurveTo(px(28.2), py(36), px(25.6), py(32.2), px(24.6), py(28.2));
  s.closePath();
  return s;
}

/** 四片翼的 three Shape（单位翼展，翼根铰链在 x=0、沿 y 轴为身体方向） */
export function createButterflyWingShapes(): {
  upperLeft: Shape;
  upperRight: Shape;
  lowerLeft: Shape;
  lowerRight: Shape;
} {
  return {
    upperLeft: buildUpperLeft(),
    upperRight: buildUpperRight(),
    lowerLeft: buildLowerLeft(),
    lowerRight: buildLowerRight(),
  };
}

/** 三色水晶渐变顶点色（icon.svg 同款：翼尖青 → 中带品牌蓝 → 翼根紫） */
function paintCrystalGradient(geometry: BufferGeometry): BufferGeometry {
  const [tipHex, midHex, rootHex] = WORLD_COLORS.crystal;
  const tip = new Color(tipHex);
  const mid = new Color(midHex);
  const root = new Color(rootHex);
  const blend = new Color();
  const position = geometry.getAttribute("position") as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    // 归一化翼面坐标：nx 沿翼展向外（0 根 → 1 尖），ny 沿弦向上
    const nx = Math.min(1, Math.abs(x) / (BUTTERFLY_UNIT_SPAN / 2));
    const ny = Math.min(1, Math.max(0, (y + 0.32) / 0.64));
    const t = Math.min(1, Math.max(0, nx * 0.65 + ny * 0.35));
    if (t < 0.5) blend.lerpColors(root, mid, t * 2);
    else blend.lerpColors(mid, tip, (t - 0.5) * 2);
    colors[i * 3] = blend.r;
    colors[i * 3 + 1] = blend.g;
    colors[i * 3 + 2] = blend.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/**
 * 单侧翼对几何（上翼 + 下翼合并为一片，绕身体轴扇动时同侧成一体）：
 * XY 平面、翼根铰链在 x=0；带三色水晶顶点色；按目标翼展缩放。
 * 调用方负责 dispose。
 */
export function createWingPairGeometry(
  side: "left" | "right",
  wingspan: number,
  curveSegments = 10,
): BufferGeometry {
  const shapes = createButterflyWingShapes();
  const upper = new ShapeGeometry(
    side === "left" ? shapes.upperLeft : shapes.upperRight,
    curveSegments,
  );
  const lower = new ShapeGeometry(
    side === "left" ? shapes.lowerLeft : shapes.lowerRight,
    curveSegments,
  );
  const merged = mergeGeometries([upper, lower], false);
  upper.dispose();
  lower.dispose();
  if (!merged) {
    throw new Error(`翼对几何合并失败（side=${side}）`);
  }
  const scale = wingspan / BUTTERFLY_UNIT_SPAN;
  merged.scale(scale, scale, scale);
  merged.computeVertexNormals();
  return paintCrystalGradient(merged);
}

/**
 * 完整蝶形单网格（R4 导览标 / 门架共用）：四片翼合并为一块平面几何，
 * 带品牌三色顶点色。用于小尺寸标志性图形，避免用 4 个 mesh 拼标识。
 */
export function createButterflyGlyphGeometry(
  wingspan: number,
  curveSegments = 8,
): BufferGeometry {
  const shapes = createButterflyWingShapes();
  const parts = [
    new ShapeGeometry(shapes.upperLeft, curveSegments),
    new ShapeGeometry(shapes.upperRight, curveSegments),
    new ShapeGeometry(shapes.lowerLeft, curveSegments),
    new ShapeGeometry(shapes.lowerRight, curveSegments),
  ];
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("蝶形标志几何合并失败");
  const scale = wingspan / BUTTERFLY_UNIT_SPAN;
  merged.scale(scale, scale, scale);
  merged.computeVertexNormals();
  return paintCrystalGradient(merged);
}

/**
 * 单侧翼对的实体几何（R4 蝶枢专用）：
 * - 厚度改为「世界单位」口径（约 12cm），不再随翼展放大成 1m 厚板；
 * - 顶点沿翼展方向前弯，形成真实曲面，侧看不再是纸片；
 * - 独立的前后翼轮廓，保留品牌三色顶点色。
 * 调用方负责 dispose。
 */
export function createWingPairSolidGeometry(
  side: "left" | "right",
  wingspan: number,
  thickness = 0.12,
  curveSegments = 6,
): BufferGeometry {
  // 中央雕塑独用轮廓，不影响小型蝴蝶与标识的共用 Shape。
  const x = (value: number) => (side === "left" ? px(value) : -px(value));
  const upperShape = new Shape();
  upperShape.moveTo(x(22.6), py(19.6));
  upperShape.bezierCurveTo(x(18.6), py(12.8), x(10.1), py(7.0), x(6.0), py(8.35));
  upperShape.bezierCurveTo(x(4.55), py(9.55), x(5.6), py(14.1), x(7.1), py(17.0));
  upperShape.bezierCurveTo(x(7.8), py(18.5), x(8.55), py(18.25), x(9.25), py(19.25));
  upperShape.bezierCurveTo(x(10.35), py(20.8), x(12.0), py(20.2), x(13.4), py(21.1));
  upperShape.bezierCurveTo(x(16.3), py(22.8), x(20.0), py(23.35), x(22.6), py(23.2));
  upperShape.bezierCurveTo(x(23.05), py(22.1), x(23.0), py(20.6), x(22.6), py(19.6));
  upperShape.closePath();

  const lowerShape = new Shape();
  lowerShape.moveTo(x(22.8), py(25.4));
  lowerShape.bezierCurveTo(x(19.4), py(23.45), x(14.1), py(24.6), x(12.0), py(28.0));
  lowerShape.bezierCurveTo(x(10.1), py(30.8), x(10.8), py(32.8), x(13.0), py(33.45));
  lowerShape.bezierCurveTo(x(13.8), py(33.7), x(14.0), py(36.1), x(15.3), py(36.85));
  lowerShape.bezierCurveTo(x(16.0), py(37.2), x(16.2), py(35.6), x(17.1), py(35.4));
  lowerShape.bezierCurveTo(x(20.4), py(34.9), x(22.5), py(31.2), x(23.4), py(28.2));
  lowerShape.bezierCurveTo(x(23.6), py(26.75), x(23.2), py(25.9), x(22.8), py(25.4));
  lowerShape.closePath();

  const scale = wingspan / BUTTERFLY_UNIT_SPAN;
  const depth = thickness / scale;
  const bevel = 0.032 / scale;
  const options = {
    depth,
    steps: 1,
    curveSegments,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel * 0.7,
  } as const;
  // 把固定采样预算集中在长前缘和翼尖，避免用增加面数换取圆滑。
  const sampleWing = (shape: Shape, segments: readonly number[]) =>
    new Shape(
      shape.curves.flatMap((curve, index) =>
        curve.getPoints(Math.max(2, Math.round(segments[index] * curveSegments / 6))).slice(0, -1),
      ),
    );
  const upper = new ExtrudeGeometry(sampleWing(upperShape, [12, 10, 4, 4, 4, 2]), options);
  const lower = new ExtrudeGeometry(sampleWing(lowerShape, [9, 8, 7, 5, 5, 2]), options);
  lower.translate(0, 0, -0.045 / scale);
  const merged = mergeGeometries([upper, lower], false);
  upper.dispose();
  lower.dispose();
  if (!merged) {
    throw new Error(`实体翼对几何合并失败（side=${side}）`);
  }
  merged.translate(0, 0, -depth / 2);
  merged.scale(scale, scale, scale);

  // 沿翼展前弯：翼根平、翼尖前探，形成可读的立体翼面
  const halfSpan = wingspan / 2;
  const position = merged.getAttribute("position") as BufferAttribute;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const normalized = Math.min(1, Math.abs(x) / halfSpan);
    position.setZ(
      i,
      position.getZ(i) + halfSpan * 0.05 * Math.pow(normalized, 1.7),
    );
  }
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return paintCrystalGradient(merged);
}

/**
 * 翼脉（R4）：每条翼 4 根抬起的管状脉络，沿曲面贴合。
 * 合并为单几何（每侧 1 个 draw call），金属冷光材质。
 */
export function createWingVeinsGeometry(
  side: "left" | "right",
  wingspan: number,
): BufferGeometry {
  const span = wingspan / BUTTERFLY_UNIT_SPAN;
  const sign = side === "left" ? -1 : 1;
  const paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [
      [0.03, 0.075],
      [0.18, 0.22],
      [0.345, 0.29],
    ],
    [
      [0.03, 0.045],
      [0.16, 0.115],
      [0.3, 0.105],
    ],
    [
      [0.025, -0.055],
      [0.13, -0.085],
      [0.235, -0.14],
    ],
    [
      [0.025, -0.055],
      [0.11, -0.17],
      [0.175, -0.245],
    ],
  ];
  const tubes = paths.map((path, index) => {
    const points = path.map(([x, y]) => {
      const worldX = sign * x * span;
      const normalized = Math.min(1, Math.abs(worldX) / (wingspan / 2));
      return new Vector3(
        worldX,
        y * span,
        0.072 + (index >= 2 ? -0.045 : 0) + (wingspan / 2) * 0.05 * Math.pow(normalized, 1.7),
      );
    });
    const curve = new CatmullRomCurve3(points);
    return new TubeGeometry(
      curve,
      10,
      (index === 0 ? 0.0045 : 0.0032) * span,
      4,
      false,
    );
  });
  const merged = mergeGeometries(tubes, false);
  tubes.forEach((tube) => tube.dispose());
  if (!merged) throw new Error(`翼脉几何合并失败（side=${side}）`);
  merged.computeBoundingSphere();
  return merged;
}
