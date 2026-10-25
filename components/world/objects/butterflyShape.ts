import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Shape,
  ShapeGeometry,
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
