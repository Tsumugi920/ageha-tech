import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  RGBAFormat,
  Shape,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Wing = "fore" | "hind";
export const WING_HINGE = 0.26;
const SPAN = 7.6;
const TAU = Math.PI * 2;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function wingOutline(kind: Wing) {
  const shape = new Shape();
  if (kind === "fore") {
    shape.moveTo(0.24, 0.22);
    shape.bezierCurveTo(0.65, 0.99, 2.03, 2.55, 3.43, 2.77);
    shape.bezierCurveTo(3.74, 2.83, 3.83, 2.61, 3.72, 2.22);
    shape.bezierCurveTo(3.62, 1.77, 3.47, 1.31, 3.22, 1.00);
    shape.bezierCurveTo(3.11, 0.85, 2.99, 0.91, 2.86, 0.70);
    shape.bezierCurveTo(2.72, 0.50, 2.55, 0.59, 2.37, 0.37);
    shape.bezierCurveTo(2.18, 0.17, 1.99, 0.25, 1.72, 0.09);
    shape.bezierCurveTo(1.21, -0.18, 0.63, -0.14, 0.24, 0.02);
    shape.bezierCurveTo(0.20, 0.08, 0.20, 0.16, 0.24, 0.22);
  } else {
    shape.moveTo(0.23, 0.10);
    shape.bezierCurveTo(0.96, 0.30, 2.09, 0.26, 2.61, -0.40);
    shape.bezierCurveTo(2.95, -0.84, 2.85, -1.18, 2.57, -1.33);
    shape.bezierCurveTo(2.48, -1.38, 2.38, -1.32, 2.31, -1.45);
    shape.bezierCurveTo(2.22, -1.64, 2.05, -1.52, 1.97, -1.72);
    shape.bezierCurveTo(1.82, -1.99, 1.78, -2.34, 1.62, -2.43);
    shape.bezierCurveTo(1.44, -2.55, 1.40, -2.16, 1.26, -2.05);
    shape.bezierCurveTo(1.11, -1.94, 0.99, -2.02, 0.85, -1.82);
    shape.bezierCurveTo(0.50, -1.36, 0.25, -0.61, 0.23, 0.10);
  }
  shape.closePath();
  return shape;
}

function midSurface(kind: Wing, x: number, y: number) {
  if (kind === "fore") {
    const s = clamp(x / 3.8);
    return 0.02 + 0.48 * Math.sin(Math.PI * s) * Math.cos((y - 0.9) * 0.65)
      + 0.26 * s * s + 0.15 * y * s;
  }
  return -0.20 - 0.36 * Math.sin(Math.PI * clamp(x / 3)) + 0.09 * y
    + 0.36 * (1 - smooth(0.28, 0.85, x));
}

function halfThickness(kind: Wing, x: number) {
  return 0.022 + 0.06 * Math.sin(Math.PI * clamp(x / (kind === "fore" ? 3.8 : 3)));
}

function surfacePoint(kind: Wing, x: number, y: number, offset = 0) {
  return new Vector3(x, y, midSurface(kind, x, y) + halfThickness(kind, x) + offset);
}

function wingColor(kind: Wing, x: number, y: number, radial: number, front: boolean) {
  const root = new Color(kind === "fore" ? "#154888" : "#254692");
  const azure = new Color(kind === "fore" ? "#298FC9" : "#347DD0");
  const ice = new Color("#B6EDFA");
  const edge = new Color("#123D6C");
  const color = root.lerp(azure, smooth(0.25, 1.9, x));
  const ribbon = Math.exp(-Math.pow((x - (kind === "fore" ? 2.15 : 1.85)) / 0.67, 2));
  color.lerp(ice, ribbon * (kind === "fore" ? 0.82 : 0.68));
  color.lerp(edge, smooth(0.83, 0.98, radial) * 0.96);
  const grain = 1 + 0.027 * Math.sin(x * 165 + y * 80) * Math.sin(y * 146 - x * 52);
  color.multiplyScalar(grain * (front ? 1 : 0.73));
  return color;
}

function wingShell(kind: Wing) {
  const outline = wingOutline(kind).getSpacedPoints(128).slice(0, -1);
  const area = outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length];
    return sum + p.x * q.y - p.y * q.x;
  }, 0);
  if (area < 0) outline.reverse();
  const hub = kind === "fore" ? new Vector2(1.65, 1.13) : new Vector2(1.30, -0.80);
  const rings = 16;
  const count = outline.length;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const add = (x: number, y: number, radial: number, front: boolean) => {
    positions.push(x, y, midSurface(kind, x, y) + halfThickness(kind, x) * (front ? 1 : -1));
    wingColor(kind, x, y, radial, front).toArray(colors, colors.length);
    uvs.push(x / 3.8, (y + 2.6) / 5.5);
  };
  const layerSize = 1 + rings * count;
  for (const front of [true, false]) {
    const base = front ? 0 : layerSize;
    add(hub.x, hub.y, 0, front);
    for (let ring = 1; ring <= rings; ring++) {
      const radial = ring / rings;
      for (const point of outline) {
        add(hub.x + (point.x - hub.x) * radial, hub.y + (point.y - hub.y) * radial, radial, front);
      }
    }
    const triangle = (a: number, b: number, c: number) => indices.push(base + a, base + (front ? b : c), base + (front ? c : b));
    for (let j = 0; j < count; j++) triangle(0, 1 + j, 1 + (j + 1) % count);
    for (let ring = 1; ring < rings; ring++) {
      for (let j = 0; j < count; j++) {
        const a = 1 + (ring - 1) * count + j;
        const b = 1 + (ring - 1) * count + (j + 1) % count;
        triangle(a, a + count, b + count);
        triangle(a, b + count, b);
      }
    }
  }
  for (let j = 0; j < count; j++) {
    const a = 1 + (rings - 1) * count + j;
    const b = 1 + (rings - 1) * count + (j + 1) % count;
    indices.push(a, b + layerSize, b, a, a + layerSize, b + layerSize);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function taperedTube(points: Vector3[], radius: (t: number) => number, segments = 48, sides = 6) {
  const curve = new CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = curve.getPointAt(t);
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * TAU;
      const point = center.clone()
        .addScaledVector(frames.normals[i], radius(t) * Math.cos(angle))
        .addScaledVector(frames.binormals[i], radius(t) * Math.sin(angle));
      positions.push(point.x, point.y, point.z);
      if (i < segments) {
        const a = i * sides + j, b = i * sides + (j + 1) % sides;
        indices.push(a, b, b + sides, a, b + sides, a + sides);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function merged(parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach((part) => part.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const VEIN_TIPS: Record<Wing, readonly (readonly [number, number])[]> = {
  fore: [[3.48, 2.60], [3.49, 1.91], [3.20, 1.14], [2.83, 0.78], [2.35, 0.46], [1.76, 0.20]],
  hind: [[2.47, -0.44], [2.65, -0.97], [2.26, -1.35], [1.91, -1.57], [1.62, -2.26], [1.02, -1.78]],
};

function wingDetails(kind: Wing) {
  const veins: BufferGeometry[] = [];
  const markings: BufferGeometry[] = [];
  for (const [index, [tx, ty]] of VEIN_TIPS[kind].entries()) {
    const root = kind === "fore" ? [0.28, 0.20] : [0.27, -0.08];
    const path = Array.from({ length: 33 }, (_, step) => {
      const t = step / 32;
      const x = root[0] + (tx - root[0]) * t;
      const y = root[1] + (ty - root[1]) * t + Math.sin(t * Math.PI) * (kind === "fore" ? 0.19 : 0.12);
      return surfacePoint(kind, x, y, 0.006);
    });
    veins.push(taperedTube(path, (t) => (0.024 - 0.014 * t) * (index === 0 ? 1.15 : 1), 40));
    if (index > 0 && index < 5) {
      const previous = VEIN_TIPS[kind][index - 1];
      const x = (tx + previous[0]) / 2 * 0.955;
      const y = (ty + previous[1]) / 2 * 0.955;
      const spots = new Shape();
      spots.absellipse(x, y, kind === "fore" ? 0.065 : 0.075, 0.105, 0, TAU, false, -0.4);
      const contour = spots.getPoints(20);
      const positions: number[] = [];
      const indices: number[] = [];
      surfacePoint(kind, x, y, 0.012).toArray(positions, 0);
      contour.forEach((p) => surfacePoint(kind, p.x, p.y, 0.009).toArray(positions, positions.length));
      for (let i = 1; i < contour.length; i++) indices.push(0, i, i + 1);
      const spot = new BufferGeometry();
      spot.setAttribute("position", new Float32BufferAttribute(positions, 3));
      spot.setIndex(indices);
      spot.computeVertexNormals();
      markings.push(spot);
    }
  }
  const border = wingOutline(kind).getSpacedPoints(160).map((p) => surfacePoint(kind, p.x, p.y, -0.006));
  veins.push(taperedTube(border, () => 0.018, 160));
  const root = kind === "fore" ? [0.28, 0.20] : [0.27, -0.08];
  const crossCurve = new CatmullRomCurve3(VEIN_TIPS[kind].slice(0, 5).map(([x, y]) => {
    const t = 0.56;
    return new Vector3(root[0] + (x - root[0]) * t, root[1] + (y - root[1]) * t + Math.sin(t * Math.PI) * (kind === "fore" ? 0.19 : 0.12), 0);
  }));
  const cross = crossCurve.getPoints(40).map((p) => surfacePoint(kind, p.x, p.y, 0.006));
  veins.push(taperedTube(cross, () => 0.010, 40));
  return { veins: merged(veins), markings: merged(markings) };
}

function placeWing(geometry: BufferGeometry, side: "left" | "right", wingspan: number) {
  const sign = side === "left" ? -1 : 1;
  const scale = wingspan / SPAN;
  geometry.translate(-WING_HINGE, 0, 0);
  geometry.scale(sign * scale, scale, scale);
  if (sign < 0) {
    const index = geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createSculptureWing(side: "left" | "right", wingspan = SPAN) {
  const fore = wingDetails("fore");
  const hind = wingDetails("hind");
  return {
    shell: placeWing(merged([wingShell("fore"), wingShell("hind")]), side, wingspan),
    veins: placeWing(merged([fore.veins, hind.veins]), side, wingspan),
    markings: placeWing(merged([fore.markings, hind.markings]), side, wingspan),
  };
}

export function createWingTransmissionMap() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = i / (size - 1) * 3.8;
      const y = j / (size - 1) * 5.5 - 2.6;
      const fore = Math.exp(-((x - 2.35) ** 2 / 0.30 + (y - 1.50) ** 2 / 0.48));
      const hind = Math.exp(-((x - 1.95) ** 2 / 0.22 + (y + 0.85) ** 2 / 0.24));
      const value = Math.round(Math.max(fore, hind) * 255);
      const offset = (j * size + i) * 4;
      data.set([value, value, value, 255], offset);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createSculptureBody() {
  // x/y/z encode width, height and depth; the dorsal centerline is not rotationally symmetric.
  const profile = new CatmullRomCurve3([
    new Vector3(0.006, -1.57, 0.008),
    new Vector3(0.09, -1.40, 0.09),
    new Vector3(0.18, -1.09, 0.16),
    new Vector3(0.245, -0.73, 0.205),
    new Vector3(0.26, -0.42, 0.225),
    new Vector3(0.23, -0.21, 0.235),
    new Vector3(0.34, 0.02, 0.32),
    new Vector3(0.355, 0.28, 0.335),
    new Vector3(0.27, 0.49, 0.275),
    new Vector3(0.145, 0.62, 0.18),
    new Vector3(0.205, 0.79, 0.215),
    new Vector3(0.16, 0.96, 0.165),
    new Vector3(0.008, 1.02, 0.008),
  ]);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const rows = 112, columns = 40;
  const dark = new Color("#112C4B"), blue = new Color("#427EA2"), pearl = new Color("#A2D8EB");
  for (let i = 0; i <= rows; i++) {
    const section = profile.getPoint(i / rows);
    const y = section.y;
    const abdomen = 1 - smooth(-0.30, -0.18, y);
    const groove = Math.pow(0.5 + 0.5 * Math.cos((y + 0.30) * 29), 10) * abdomen;
    const centerZ = 0.035 + 0.09 * Math.cos((y - 0.1) * 1.8);
    for (let j = 0; j < columns; j++) {
      const angle = j / columns * TAU;
      const dorsal = Math.max(0, Math.cos(angle));
      const width = section.x * (1 - 0.10 * groove);
      const depth = section.z * (1 - 0.075 * groove);
      positions.push(Math.sin(angle) * width, y, centerZ + Math.cos(angle) * depth + 0.045 * dorsal ** 8 * (1 - abdomen));
      const color = dark.clone().lerp(blue, dorsal * 0.72);
      color.lerp(pearl, Math.pow(dorsal, 18) * (0.5 + abdomen * 0.28));
      color.multiplyScalar(1 - 0.38 * groove);
      color.toArray(colors, colors.length);
      if (i < rows) {
        const a = i * columns + j, b = i * columns + (j + 1) % columns;
        indices.push(a, b, b + columns, a, b + columns, a + columns);
      }
    }
  }
  for (const end of [0, rows]) {
    const center = positions.length / 3;
    const section = profile.getPoint(end / rows);
    positions.push(0, section.y, 0.035 + 0.09 * Math.cos((section.y - 0.1) * 1.8));
    dark.toArray(colors, colors.length);
    for (let j = 0; j < columns; j++) {
      const a = end * columns + j, b = end * columns + (j + 1) % columns;
      indices.push(center, end === 0 ? b : a, end === 0 ? a : b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createSculptureAntennae() {
  return merged([-1, 1].map((side) => taperedTube([
    new Vector3(side * 0.11, 0.92, 0.12),
    new Vector3(side * 0.25, 1.23, 0.18),
    new Vector3(side * 0.47, 1.55, 0.22),
    new Vector3(side * 0.68, 1.70, 0.20),
    new Vector3(side * 0.74, 1.66, 0.18),
  ], (t) => (0.018 - 0.009 * t + 0.026 * Math.exp(-(((t - 0.94) / 0.065) ** 2))) * Math.min(1, (1 - t) * 60), 56, 8)));
}
