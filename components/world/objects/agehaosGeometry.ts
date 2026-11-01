import { ExtrudeGeometry, Path, Shape, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Point = readonly [number, number];

function panel(points: readonly Point[], depth: number, z: number, bevel = 0.08) {
  const shape = new Shape();
  points.forEach(([x, y], index) => index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true, bevelSegments: 1,
    bevelThickness: bevel, bevelSize: bevel, curveSegments: 1,
  });
  geometry.translate(0, 0, z);
  return geometry;
}

function combine(parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function clippedFace(width: number, height: number, cut: number): Point[] {
  const x = width / 2, y = height / 2;
  return [[-x + cut, -y], [x - cut, -y], [x, -y + cut], [x, y - cut], [x - cut, y], [-x + cut, y], [-x, y - cut], [-x, -y + cut]];
}

export function createAgehaosGeometry() {
  const chassis = combine([
    panel([
      [-1.98, 0.5], [-2.18, 1.35], [-2.18, 2.9], [-3.48, 6.15],
      [-3.48, 8.35], [-2.35, 9.48], [-0.42, 9.48], [-0.42, 8.9],
      [-1.72, 8.52], [-2.18, 7.75], [-2.18, 6.45], [-1.12, 3.55], [-0.86, 0.5],
    ], 1.62, -0.92, 0.12),
    panel([
      [0.86, 0.5], [1.98, 0.5], [2.18, 1.35], [2.18, 2.9],
      [3.38, 5.8], [3.38, 7.35], [2.36, 8.37], [0.65, 8.37],
      [0.65, 7.79], [1.79, 7.43], [2.05, 6.94], [2.05, 6.1], [1.12, 3.55],
    ], 1.62, -0.92, 0.12),
    panel([[-1.6, 0.48], [1.6, 0.48], [1.82, 1.12], [1.5, 1.7], [-1.5, 1.7], [-1.82, 1.12]], 2.15, -1.2, 0.12),
  ]);
  const armor = combine([
    panel([
      [-1.76, 1.02], [-1.95, 1.48], [-1.95, 3.03], [-3.23, 6.25],
      [-3.23, 8.22], [-2.25, 9.2], [-0.66, 9.2], [-1.94, 8.7],
      [-2.43, 7.88], [-2.43, 6.36], [-1.4, 3.46], [-1.13, 1.02],
    ], 0.14, 0.79, 0.07),
    panel([
      [1.13, 1.02], [1.76, 1.02], [1.95, 1.48], [1.95, 3.02],
      [3.13, 5.91], [3.13, 7.23], [2.26, 8.1], [0.89, 8.1],
      [2.0, 7.6], [2.3, 7.02], [2.3, 6.03], [1.4, 3.46],
    ], 0.14, 0.79, 0.07),
  ]);
  const rearArmor = armor.clone();
  rearArmor.scale(1, 1, -1);
  // Mirroring positions alone reverses triangle winding; the rear skin must remain outward-facing.
  const position = rearArmor.getAttribute("position");
  for (const attribute of Object.values(rearArmor.attributes)) {
    for (let i = 0; i < position.count; i += 3) {
      for (let axis = 0; axis < attribute.itemSize; axis++) {
        const a = (i + 1) * attribute.itemSize + axis;
        const b = (i + 2) * attribute.itemSize + axis;
        const value = attribute.array[a];
        attribute.array[a] = attribute.array[b];
        attribute.array[b] = value;
      }
    }
  }
  rearArmor.translate(0, 0, -0.22);
  const ceramic = combine([armor, rearArmor]);
  const consoleBody = panel([
    [-1.52, 1.15], [1.52, 1.15], [2.23, 1.97], [2.23, 3.42],
    [1.86, 3.88], [-1.86, 3.88], [-2.23, 3.42], [-2.23, 1.97],
  ], 1.88, -0.25, 0.12);
  const consoleRim = panel([
    [-1.6, 1.68], [1.6, 1.68], [2.05, 1.96], [2.05, 3.4],
    [1.78, 3.64], [-1.78, 3.64], [-2.05, 3.4], [-2.05, 1.96],
  ], 0.1, 1.78, 0.05);
  const saddle = panel([
    [-1.5, 3.84], [1.5, 3.84], [1.02, 4.45], [0.58, 4.58],
    [-0.58, 4.58], [-1.02, 4.45],
  ], 1.36, -0.76, 0.09);
  const channels = combine([
    panel([[-2.98, 6.5], [-2.88, 6.5], [-2.88, 8.06], [-2.07, 8.86], [-2.18, 8.86], [-2.98, 8.08]], 0.015, 1.015, 0.008),
    panel([[2.78, 6.03], [2.87, 6.03], [2.87, 7.07], [2.13, 7.83], [2.01, 7.83], [2.78, 7.04]], 0.015, 1.015, 0.008),
  ]);
  const kernel = panel(clippedFace(1.98, 1.98, 0.28), 0.64, -0.32, 0.12);
  const bezelShape = new Shape();
  clippedFace(1.84, 1.84, 0.26).forEach(([x, y], i) => i === 0 ? bezelShape.moveTo(x, y) : bezelShape.lineTo(x, y));
  bezelShape.closePath();
  const hole = new Path();
  clippedFace(1.36, 1.36, 0.19).reverse().forEach(([x, y], i) => i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y));
  hole.closePath();
  bezelShape.holes.push(hole);
  const bezel = new ExtrudeGeometry(bezelShape, { depth: 0.07, steps: 1, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 1 });
  bezel.translate(0, 0, 0.46);
  const lens = panel(clippedFace(1.27, 1.27, 0.18), 0.1, 0.36, 0.035);
  for (const geometry of [chassis, ceramic, channels]) {
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      positions.setZ(i, positions.getZ(i) - Math.max(0, positions.getY(i) - 3) * 0.18);
    }
    geometry.computeVertexNormals();
  }
  const asset = { chassis, ceramic, consoleBody, consoleRim, saddle, channels, kernel, bezel, lens };
  Object.values(asset).forEach((geometry) => { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); });
  return asset;
}
