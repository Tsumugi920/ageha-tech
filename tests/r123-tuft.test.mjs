import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { CylinderGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { PINE_FORMS, buildPineFoliage } from "../components/world/terrain/floraGeometry.ts";

test("R12.3-B tuft trunk stays behind foliage throughout the upper crown", () => {
  const crown = buildPineFoliage(PINE_FORMS.tuft);
  const height = PINE_FORMS.tuft.trunkHeight ?? 1.15;
  const trunk = new CylinderGeometry(0.07, 0.13, height, 5);
  trunk.translate(0, (PINE_FORMS.tuft.trunkBase ?? 0) + height / 2, 0);
  const material = new MeshBasicMaterial();
  const leaves = new Mesh(crown, material), wood = new Mesh(trunk, material);
  leaves.updateMatrixWorld(); wood.updateMatrixWorld();
  const ray = new Raycaster(), exposed = [];
  try {
    for (let y = 0.98; y < 1.2; y += 0.02) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const direction = new Vector3(Math.cos(a), 0, Math.sin(a));
      ray.set(direction.clone().multiplyScalar(2).setY(y), direction.clone().negate());
      const leaf = ray.intersectObject(leaves, false)[0], bark = ray.intersectObject(wood, false)[0];
      if (bark && (!leaf || bark.distance < leaf.distance - 0.001)) exposed.push({ y, angle: a });
    }
    assert.deepEqual(exposed, [], "upper dark segments must not be exposed trunk geometry");
  } finally { crown.dispose(); trunk.dispose(); material.dispose(); }
});

test("R12.3-B the three taller forms preserve every geometry attribute byte", () => {
  const expected = {
    spire: "dc94fc65df12290228995e4de432c9a3ba2429fbea1ca62c8c2734e22f667d29",
    broad: "383e19afa324ba0d920cf5815e645dda134059c64e018071c78af10147aff544",
    wind: "444ab0c628aac2d3422d79a78261d8b9c62500835746e410e8bd83a4ec65896c",
  };
  for (const [name, sha] of Object.entries(expected)) {
    const geometry = buildPineFoliage(PINE_FORMS[name]), hash = createHash("sha256");
    for (const key of Object.keys(geometry.attributes).sort()) {
      hash.update(key); hash.update(Buffer.from(geometry.attributes[key].array.buffer));
    }
    assert.equal(hash.digest("hex"), sha, name);
    assert.equal(PINE_FORMS[name].trunkHeight ?? 1.15, 1.15);
    assert.equal(PINE_FORMS[name].trunkBase ?? 0, 0);
    geometry.dispose();
  }
});

test("R12.3-B tuft has one connected crown surface within its original footprint and height", () => {
  const geometry = buildPineFoliage(PINE_FORMS.tuft), position = geometry.getAttribute("position");
  const parents = new Map();
  const find = key => { if (!parents.has(key)) parents.set(key, key); const p = parents.get(key); if (p !== key) parents.set(key, find(p)); return parents.get(key); };
  const join = (a, b) => parents.set(find(a), find(b));
  const keys = [];
  try {
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      assert.ok(Math.hypot(x, z) <= 0.435, "no wider than existing tuft envelope");
      assert.ok(y >= 0.09 && y <= 1.251, "keep tree scale and ground clearance");
      keys.push([x, y, z].map(n => Math.round(n * 1e6)).join(","));
    }
    for (let i = 0; i < keys.length; i += 3) { join(keys[i], keys[i + 1]); join(keys[i + 1], keys[i + 2]); }
    assert.equal(new Set(keys.map(find)).size, 1, "replace disconnected cone shells with a connected crown");
    assert.ok(position.count / 3 <= 100, "bounded mesh budget for the single-form sample");
  } finally { geometry.dispose(); }
});
