// Node 24: node --test tests/butterfly-sculpture.test.mjs
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Vector3, RGBAFormat } from "three";
import {
  WING_HINGE,
  createSculptureWing,
  createSculptureBody,
  createSculptureAntennae,
  createWingTransmissionMap,
} from "../components/world/objects/butterflySculpture.ts";

const PARTS = ["shell", "veins", "markings"];
const SIDES = ["left", "right"];
const wings = {};
const resources = [];
let body, antennae, transmissionMap;

function ownWing(side, span) {
  const wing = createSculptureWing(side, span);
  resources.push(...Object.values(wing));
  return wing;
}

before(() => {
  for (const side of SIDES) wings[side] = ownWing(side);
  resources.push(body = createSculptureBody());
  resources.push(antennae = createSculptureAntennae());
  resources.push(transmissionMap = createWingTransmissionMap());
});
after(() => resources.forEach((resource) => resource.dispose()));

function near(actual, expected, label, tolerance = 2e-6) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: actual=${actual}, expected=${expected}, tolerance=${tolerance}`,
  );
}

function point(geometry, index) {
  return new Vector3().fromBufferAttribute(geometry.getAttribute("position"), index);
}

// Independently derive face orientation from positions and index winding, not normal attributes.
function face(geometry, offset) {
  const ids = [0, 1, 2].map((j) => geometry.index.getX(offset + j));
  const [a, b, c] = ids.map((i) => point(geometry, i));
  return { ids, a, normal: b.sub(a).cross(c.sub(a)) };
}

function bounds(geometry, vertices) {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const i of vertices) {
    const p = point(geometry, i);
    min.min(p);
    max.max(p);
  }
  return { min, max, size: max.clone().sub(min) };
}

function assertGeometry(geometry, label) {
  assert.ok(geometry?.isBufferGeometry, `${label}: BufferGeometry`);
  const position = geometry.getAttribute("position");
  assert.equal(position.itemSize, 3, `${label}: position must be xyz`);
  assert.ok(position.count > 3, `${label}: nonempty vertices`);
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    assert.equal(attribute.count, position.count, `${label}.${name}: attribute count`);
    for (let i = 0; i < attribute.array.length; i++) {
      assert.ok(Number.isFinite(attribute.array[i]), `${label}.${name}[${i}]: finite`);
    }
  }
  assert.equal(geometry.getAttribute("normal").itemSize, 3, `${label}: normals`);
  const index = geometry.index;
  assert.ok(index && index.count > 0, `${label}: indexed faces`);
  assert.equal(index.count % 3, 0, `${label}: complete triangles`);
  for (let i = 0; i < index.count; i++) {
    const vertex = index.getX(i);
    assert.ok(Number.isInteger(vertex) && vertex >= 0 && vertex < position.count,
      `${label}: invalid index[${i}]=${vertex}, vertices=${position.count}`);
  }
  const actual = bounds(geometry, Array.from({ length: position.count }, (_, i) => i));
  assert.ok(geometry.boundingBox && geometry.boundingSphere, `${label}: cached bounds`);
  for (const axis of ["x", "y", "z"]) {
    assert.ok(actual.size[axis] > 1e-5, `${label}: nonzero ${axis} extent`);
    near(geometry.boundingBox.min[axis], actual.min[axis], `${label}: bbox min ${axis}`);
    near(geometry.boundingBox.max[axis], actual.max[axis], `${label}: bbox max ${axis}`);
    assert.ok(Number.isFinite(geometry.boundingSphere.center[axis]), `${label}: sphere center`);
  }
  const sphere = geometry.boundingSphere;
  assert.ok(Number.isFinite(sphere.radius) && sphere.radius > 0, `${label}: sphere radius`);
  for (let i = 0; i < position.count; i++) {
    assert.ok(point(geometry, i).distanceTo(sphere.center) <= sphere.radius + 2e-6,
      `${label}: bounding sphere excludes vertex ${i}`);
  }
}

// Find lobes by index connectivity, without assuming tessellation counts or merge offsets.
// Edges use original vertex indices: coordinate welding could hide an unsealed seam.
const topologyCache = new WeakMap();
function topology(geometry) {
  if (topologyCache.has(geometry)) return topologyCache.get(geometry);
  const parent = Array.from({ length: geometry.getAttribute("position").count }, (_, i) => i);
  function root(i) {
    while (i !== parent[i]) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  const edges = new Map();
  for (let offset = 0; offset < geometry.index.count; offset += 3) {
    const ids = [0, 1, 2].map((j) => geometry.index.getX(offset + j));
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j + 1) % 3];
      parent[root(b)] = root(a);
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = edges.get(key) ?? { key, faces: [], balance: 0 };
      edge.faces.push(offset / 3);
      edge.balance += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  const groups = new Map();
  for (let i = 0; i < parent.length; i++) {
    const id = root(i);
    if (!groups.has(id)) groups.set(id, { vertices: [], offsets: [] });
    groups.get(id).vertices.push(i);
  }
  for (let offset = 0; offset < geometry.index.count; offset += 3) {
    groups.get(root(geometry.index.getX(offset))).offsets.push(offset);
  }
  const result = { edges: [...edges.values()], components: [...groups.values()] };
  topologyCache.set(geometry, result);
  return result;
}

function signedVolume(geometry, component) {
  // Only interpretable as enclosed volume after coherent winding has been checked.
  return component.offsets.reduce((sum, offset) => {
    const { a, normal } = face(geometry, offset);
    return sum + a.dot(normal) / 6;
  }, 0);
}

function assertClosed(geometry, label, expectedComponents) {
  const { edges, components } = topology(geometry);
  assert.equal(components.length, expectedComponents, `${label}: connected components`);
  const open = edges.filter((edge) => edge.faces.length !== 2);
  assert.equal(open.length, 0,
    `${label}: ${open.length} edges do not have exactly two incident faces; ${JSON.stringify(open.slice(0, 3))}`);
  for (let offset = 0; offset < geometry.index.count; offset += 3) {
    assert.ok(face(geometry, offset).normal.length() > 1e-12,
      `${label}: degenerate triangle ${offset / 3}`);
  }
}

function assertOutward(geometry, label) {
  const { edges, components } = topology(geometry);
  const inconsistent = edges.filter((edge) => edge.faces.length === 2 && edge.balance !== 0);
  const volumes = components.map((component) => signedVolume(geometry, component));
  assert.equal(inconsistent.length, 0,
    `${label}: ${inconsistent.length} shared edges have same-direction winding; ` +
    `examples=${JSON.stringify(inconsistent.slice(0, 3))}; signed volumes=${JSON.stringify(volumes)}`);
  for (const [i, volume] of volumes.entries()) {
    assert.ok(volume > 1e-6, `${label}: component ${i} must face outward, signed volume=${volume}`);
  }
}

test("雕塑翼接口：铰链为 0.26，左右均返回 shell / veins / markings", () => {
  assert.equal(WING_HINGE, 0.26);
  for (const side of SIDES) assert.deepEqual(Object.keys(wings[side]).sort(), [...PARTS].sort());
});

for (const side of SIDES) {
  for (const part of PARTS) {
    test(`${side}.${part}：有限顶点 / 法线、有效索引及非零包围盒`, () => {
      assertGeometry(wings[side][part], `${side}.${part}`);
    });
  }
  test(`${side}.shell：前后翼均为封闭索引流形，三角形预算 <20000`, (t) => {
    const shell = wings[side].shell;
    assertClosed(shell, `${side}.shell`, 2);
    const triangles = shell.index.count / 3;
    assert.ok(triangles < 20000, `${side}.shell: ${triangles} triangles exceeds budget`);
    t.diagnostic(`${side}.shell: ${triangles} triangles, ${topology(shell).edges.length} edges`);
  });
  test(`${side}.shell：相邻面绕向一致且整体法线朝外`, () => {
    assertOutward(wings[side].shell, `${side}.shell`);
  });
  test(`${side}.shell：前后翼轮廓不同，两片翼各自有明显 z 曲面起伏`, (t) => {
    const shell = wings[side].shell;
    const lobes = topology(shell).components.map((component) => ({
      ...component, ...bounds(shell, component.vertices),
    })).sort((a, b) => b.max.y - a.max.y);
    assert.equal(lobes.length, 2, "前翼和后翼必须是两个独立壳体");
    const [fore, hind] = lobes;
    assert.ok(fore.max.y > 2 && hind.min.y < -2, "前翼朝上、后翼朝下");
    assert.ok(fore.size.x > hind.size.x * 1.15,
      `前翼应比后翼宽而非复制同一轮廓: ${fore.size.x} vs ${hind.size.x}`);
    for (const [name, lobe] of [["fore", fore], ["hind", hind]]) {
      // Pair the two surfaces at identical XY coordinates; a thick flat extrusion
      // must not pass merely because its thickness provides a large Z bounding box.
      const samples = new Map();
      for (const i of lobe.vertices) {
        const p = point(shell, i);
        const key = `${p.x}:${p.y}`;
        if (!samples.has(key)) samples.set(key, []);
        samples.get(key).push(p.z);
      }
      let low = Infinity, high = -Infinity;
      for (const zs of samples.values()) {
        assert.equal(zs.length, 2, `${side}.${name}: paired front/back surfaces`);
        assert.ok(Math.abs(zs[0] - zs[1]) > 0.01, `${side}.${name}: nonzero shell thickness`);
        const midpoint = (zs[0] + zs[1]) / 2;
        low = Math.min(low, midpoint);
        high = Math.max(high, midpoint);
      }
      assert.ok(lobe.size.z > 0.55, `${side}.${name}: shell z range=${lobe.size.z}`);
      assert.ok(high - low > 0.5, `${side}.${name}: midsurface z range=${high - low}`);
      t.diagnostic(`${side}.${name}: shell z=${lobe.size.z.toFixed(6)}, midsurface z=${(high - low).toFixed(6)}`);
    }
  });
}

for (const part of PARTS) {
  test(`${part}：左右位置 / 顶点法线镜像，三角面几何法线保持正确朝向`, () => {
    const left = wings.left[part], right = wings.right[part];
    const lp = left.getAttribute("position"), rp = right.getAttribute("position");
    const ln = left.getAttribute("normal"), rn = right.getAttribute("normal");
    assert.equal(lp.count, rp.count);
    assert.equal(left.index.count, right.index.count);
    for (let i = 0; i < lp.count; i++) {
      near(lp.getX(i), -rp.getX(i), `${part}: mirrored x[${i}]`);
      near(lp.getY(i), rp.getY(i), `${part}: y[${i}]`);
      near(lp.getZ(i), rp.getZ(i), `${part}: z[${i}]`);
      near(ln.getX(i), -rn.getX(i), `${part}: mirrored normal.x[${i}]`);
      near(ln.getY(i), rn.getY(i), `${part}: normal.y[${i}]`);
      near(ln.getZ(i), rn.getZ(i), `${part}: normal.z[${i}]`);
      near(new Vector3().fromBufferAttribute(ln, i).length(), 1, `${part}: unit normal[${i}]`);
    }
    for (let offset = 0; offset < left.index.count; offset += 3) {
      const l = face(left, offset), r = face(right, offset);
      assert.deepEqual([...l.ids].sort((a, b) => a - b), [...r.ids].sort((a, b) => a - b),
        `${part}: corresponding triangle ${offset / 3}`);
      assert.ok(l.normal.length() > 1e-12 && r.normal.length() > 1e-12,
        `${part}: nondegenerate face ${offset / 3}`);
      l.normal.normalize();
      r.normal.normalize();
      r.normal.x *= -1;
      assert.ok(l.normal.dot(r.normal) > 1 - 1e-6,
        `${part}: reflected face ${offset / 3} has reversed winding (dot=${l.normal.dot(r.normal)})`);
    }
  });
}

for (const side of SIDES) {
  test(`${side}：默认翼展 7.6，缩小 / 放大时所有分层相对铰链等比例缩放`, () => {
    for (const span of [3.8, 7.6, 11.4]) {
      const scaled = ownWing(side, span);
      const factor = span / 7.6;
      for (const part of PARTS) {
        const base = wings[side][part];
        const geometry = scaled[part];
        assertGeometry(geometry, `${side}.${part}@${span}`);
        assert.deepEqual(geometry.index.array, base.index.array, `${part}: scale preserves topology`);
        const position = geometry.getAttribute("position");
        const original = base.getAttribute("position");
        for (let i = 0; i < position.array.length; i++) {
          near(position.array[i], original.array[i] * factor, `${side}.${part}@${span}: coordinate[${i}]`);
        }
        for (const name of ["uv", "color"]) {
          if (base.hasAttribute(name)) {
            assert.deepEqual(geometry.getAttribute(name).array, base.getAttribute(name).array,
              `${part}: scale preserves ${name}`);
          }
        }
        const normal = geometry.getAttribute("normal");
        const baseNormal = base.getAttribute("normal");
        for (let i = 0; i < normal.array.length; i++) {
          near(normal.array[i], baseNormal.array[i], `${side}.${part}@${span}: normal[${i}]`, 5e-4);
        }
        near(geometry.boundingSphere.radius, base.boundingSphere.radius * factor,
          `${side}.${part}@${span}: sphere radius`);
      }
    }
  });
}

test("身体：有限几何、首尾封闭、连通且法线朝外", () => {
  assertGeometry(body, "body");
  assertClosed(body, "body", 1);
  assertOutward(body, "body");
});

test("身体：胸宽腹窄且尾端收束，不是等径圆柱", (t) => {
  function widthInBand(minY, maxY) {
    const positions = body.getAttribute("position");
    const vertices = [];
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) >= minY && positions.getY(i) <= maxY) vertices.push(i);
    }
    assert.ok(vertices.length > 10, `body: populated profile band [${minY}, ${maxY}]`);
    return bounds(body, vertices).size.x;
  }
  const thorax = widthInBand(-0.1, 0.4);
  const abdomen = widthInBand(-1.2, -0.5);
  const tail = widthInBand(-1.5, -1.3);
  assert.ok(thorax > abdomen * 1.25, `胸宽=${thorax}, 腹宽=${abdomen}`);
  assert.ok(tail < abdomen * 0.6 && tail > 0, `腹宽=${abdomen}, 尾宽=${tail}`);
  t.diagnostic(`body widths: thorax=${thorax.toFixed(6)}, abdomen=${abdomen.toFixed(6)}, tail=${tail.toFixed(6)}`);
});

test("触角：左右两条独立有限几何及有效索引 / 包围盒", () => {
  assertGeometry(antennae, "antennae");
  // Tubes intentionally have open roots and collapsed tips; unlike body/shell,
  // do not impose a closed-manifold or nondegenerate-tip contract on them.
  const components = topology(antennae).components.map((component) => bounds(antennae, component.vertices))
    .sort((a, b) => a.min.x - b.min.x);
  assert.equal(components.length, 2);
  assert.ok(components[0].max.x < 0 && components[1].min.x > 0);
  near(components[0].min.x, -components[1].max.x, "antennae: outer x symmetry");
  near(components[0].max.x, -components[1].min.x, "antennae: root x symmetry");
});

function sampleTransmission(u, v) {
  const { data, width, height } = transmissionMap.image;
  const x = Math.max(0, Math.min(width - 1, Math.round(u * (width - 1))));
  const y = Math.max(0, Math.min(height - 1, Math.round(v * (height - 1))));
  return data[(y * width + x) * 4]; // Red channel is used by Three's transmission map.
}

test("透射贴图：真实 RGBA 数据，仅局部非零，前后翼各有透射亮区", (t) => {
  assert.ok(transmissionMap.isDataTexture);
  assert.equal(transmissionMap.format, RGBAFormat);
  const { data, width, height } = transmissionMap.image;
  assert.ok(data instanceof Uint8Array);
  assert.ok(Number.isInteger(width) && width > 1 && Number.isInteger(height) && height > 1);
  assert.equal(data.length, width * height * 4);
  let nonzero = 0, bright = 0;
  const values = new Set();
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i];
    assert.equal(data[i + 1], value, `pixel ${i / 4}: grayscale green`);
    assert.equal(data[i + 2], value, `pixel ${i / 4}: grayscale blue`);
    assert.equal(data[i + 3], 255, `pixel ${i / 4}: opaque alpha, not transmission mask`);
    nonzero += Number(value > 0);
    bright += Number(value > 64);
    values.add(value);
  }
  const coverage = nonzero / (width * height);
  const brightCoverage = bright / (width * height);
  // Include the quantized Gaussian falloff, not just its bright center.
  assert.ok(coverage > 0.01 && coverage < 0.6, `nonzero coverage=${coverage}`);
  assert.ok(brightCoverage > 0.01 && brightCoverage < 0.2, `bright coverage=${brightCoverage}`);
  assert.ok(values.has(0) && values.size > 32, "zero background and smooth transmission gradient");
  const sampleAt = (x, y) => sampleTransmission(x / 3.8, (y + 2.6) / 5.5);
  assert.ok(sampleAt(2.35, 1.50) > 240, "forewing transmission patch");
  assert.ok(sampleAt(1.95, -0.85) > 240, "hindwing transmission patch");
  assert.equal(sampleAt(WING_HINGE, 0), 0, "opaque wing root");
  for (const [u, v] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    assert.equal(sampleTransmission(u, v), 0, `opaque corner (${u},${v})`);
  }
  t.diagnostic(`transmission: nonzero=${(coverage * 100).toFixed(2)}%, bright=${(brightCoverage * 100).toFixed(2)}%`);
});

test("透射贴图：左右镜像翼共享同一 UV 空间和同一份贴图采样", () => {
  // This factory returns a texture owned by its caller, not a singleton. Sharing
  // here means both wings can use that ONE map without rebaking or flipping UVs;
  // material wiring in the React component is outside this geometry unit test.
  const left = wings.left.shell.getAttribute("uv");
  const right = wings.right.shell.getAttribute("uv");
  assert.equal(left.itemSize, 2);
  assert.equal(left.count, wings.left.shell.getAttribute("position").count);
  assert.deepEqual(left.array, right.array, "mirrored geometry must not mirror the shared UV map");
  let opaque = 0, transmitting = 0;
  for (let i = 0; i < left.count; i++) {
    const u = left.getX(i), v = left.getY(i);
    assert.ok(Number.isFinite(u) && Number.isFinite(v) && u >= 0 && u <= 1 && v >= 0 && v <= 1,
      `shell uv[${i}]=(${u},${v}) must lie inside the map`);
    const value = sampleTransmission(u, v);
    assert.equal(value, sampleTransmission(right.getX(i), right.getY(i)), `shared map sample[${i}]`);
    opaque += Number(value === 0);
    transmitting += Number(value > 200);
  }
  assert.ok(opaque > 0 && transmitting > 0, "both opaque and transmissive patches must land on actual wings");
});
