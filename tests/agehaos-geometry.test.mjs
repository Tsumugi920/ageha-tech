import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Matrix4, Raycaster, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { createAgehaosGeometry } from "../components/world/objects/agehaosGeometry.ts";

const asset = createAgehaosGeometry();
after(() => Object.values(asset).forEach((geometry) => geometry.dispose()));

for (const [name, geometry] of Object.entries(asset)) {
  test(`${name}: finite, closed, outward-facing beveled geometry`, () => {
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    assert.ok(position.count > 0 && position.count % 3 === 0);
    for (const attribute of Object.values(geometry.attributes)) {
      assert.equal(attribute.count, position.count);
      assert.ok([...attribute.array].every(Number.isFinite));
    }
    const edges = new Map();
    const key = (v) => v.toArray().map((n) => Math.round(n * 1e5)).join(",");
    let volume = 0;
    for (let i = 0; i < position.count; i += 3) {
      const p = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(position, i + j));
      const face = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
      assert.ok(face.lengthSq() > 1e-14, `${name}: degenerate face ${i / 3}`);
      const n = new Vector3().fromBufferAttribute(normal, i);
      assert.ok(face.dot(n) > 0, `${name}: normal opposes winding ${i / 3}`);
      volume += p[0].dot(p[1].clone().cross(p[2])) / 6;
      for (let j = 0; j < 3; j++) {
        const a = key(p[j]), b = key(p[(j + 1) % 3]);
        const edgeKey = [a, b].sort().join("|");
        const edge = edges.get(edgeKey) ?? { count: 0, balance: 0 };
        edge.count++;
        edge.balance += a < b ? 1 : -1;
        edges.set(edgeKey, edge);
      }
    }
    assert.ok(volume > 0, `${name}: positive enclosed volume`);
    for (const edge of edges.values()) {
      assert.equal(edge.count, 2, `${name}: watertight edge`);
      assert.equal(edge.balance, 0, `${name}: consistent edge orientation`);
    }
    assert.ok(geometry.boundingBox && geometry.boundingSphere);
    for (let i = 0; i < position.count; i++) {
      const p = new Vector3().fromBufferAttribute(position, i);
      assert.ok(geometry.boundingBox.containsPoint(p));
      assert.ok(p.distanceTo(geometry.boundingSphere.center) <= geometry.boundingSphere.radius + 1e-6);
    }
  });
}

test("station uses bounded geometry rather than many repeated parts", () => {
  const triangles = Object.values(asset).reduce((n, geometry) => n + geometry.attributes.position.count / 3, 0);
  assert.equal(Object.keys(asset).length, 9);
  assert.ok(triangles < 4000, `triangle budget: ${triangles}`);
  const box = asset.chassis.boundingBox;
  assert.ok(box.max.y < 9.7 && box.max.y > 9.4);
  assert.ok(box.max.x - box.min.x > 6.8, "wide shoulder silhouette");
  assert.ok(box.max.z - box.min.z > 1.8, "volumetric shell, not a flat cutout");
});

test("lower structural feet stay inside the unchanged collision footprint", () => {
  for (const name of ["chassis", "ceramic", "consoleBody", "consoleRim"]) {
    const p = asset[name].attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 1.7) continue;
      assert.ok(Math.hypot(p.getX(i), p.getZ(i)) <= 2.6, `${name}: ground-level footprint exceeds collider`);
    }
  }
});

test("open silhouette and floating kernel have real negative space", () => {
  const material = new MeshBasicMaterial();
  const shell = new Mesh(asset.chassis, material);
  const ray = new Raycaster(new Vector3(0, 6.25, 10), new Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(shell).length, 0, "no cylinder behind the kernel");
  ray.set(new Vector3(-2.9, 7, 10), new Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(shell).length > 0, "left shoulder is solid");
  ray.set(new Vector3(2.9, 8.8, 10), new Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(shell).length, 0, "right crown is deliberately lower");
  const rotation = new Matrix4().makeRotationZ(Math.PI / 4);
  const vertices = asset.kernel.attributes.position;
  const bottom = Math.min(...Array.from({ length: vertices.count }, (_, i) => new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(rotation).y));
  assert.ok(bottom + 6.42 - 0.07 > asset.saddle.boundingBox.max.y + 0.15, "animated core clears its saddle");
  material.dispose();
});

test("processor bezel has a real aperture instead of coplanar overlays", () => {
  const material = new MeshBasicMaterial();
  const bezel = new Mesh(asset.bezel, material);
  const ray = new Raycaster(new Vector3(0, 0, 2), new Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(bezel).length, 0);
  ray.set(new Vector3(0.8, 0, 2), new Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(bezel).length > 0);
  assert.ok(asset.lens.boundingBox.max.z < asset.bezel.boundingBox.max.z);
  material.dispose();
});
