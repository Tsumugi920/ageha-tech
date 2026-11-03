import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createRoot, _roots } from "@react-three/fiber";
import { PCFShadowMap } from "three";
import { createCrystalSprayGeometry } from "../components/world/terrain/islandGeometry.ts";
import { TIER_PARAMS } from "../lib/world/performance.ts";

test("R12.3-A crystal tips avoid redundant conversion and preserve existing geometry bytes", t => {
  const warn = t.mock.method(console, "warn", () => {});
  const geometry = createCrystalSprayGeometry([
    { height: 1.48, radius: 0.32, tiltZ: 0.05 },
    { x: 0.42, z: 0.18, height: 0.98, radius: 0.23, tiltZ: -0.26, spin: 0.5 },
    { x: -0.34, z: 0.3, height: 0.7, radius: 0.17, tiltZ: 0.28, spin: -0.4 },
    { x: 0.06, z: -0.32, height: 0.52, radius: 0.12, tiltX: 0.2, spin: 0.9 },
  ]);
  try {
    const hash = createHash("sha256");
    for (const name of Object.keys(geometry.attributes).sort()) {
      hash.update(name);
      hash.update(Buffer.from(geometry.attributes[name].array.buffer));
    }
    assert.equal(hash.digest("hex"), "e9461a109eedcb6f39f4187c340aef16c64dbe10a0cf4bff178ef859402ebc73");
    assert.equal(geometry.index, null);
    assert.equal(warn.mock.calls.length, 0);
  } finally { geometry.dispose(); }
});

test("R12.3-A actual Canvas shadow input selects PCF across all initial quality tiers", async () => {
  // Read the real call-site expression, then pass it through installed R3F configuration.
  const source = ts.createSourceFile("WorldCanvas.tsx", readFileSync(new URL("../components/world/WorldCanvas.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === "Canvas") {
      const attribute = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === "shadows");
      expression = attribute?.initializer?.expression?.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression, "Canvas must have an explicit shadow configuration");
  for (const initialTier of Object.values(TIER_PARAMS)) {
    const shadows = runInNewContext(`(${expression})`, { initialTier, PCFShadowMap });
    const canvas = { width: 1440, height: 900 };
    const gl = { render() {}, setPixelRatio() {}, setSize() {}, shadowMap: { enabled: false, type: 0 }, xr: { addEventListener() {}, removeEventListener() {} }, domElement: canvas };
    const root = createRoot(canvas);
    try {
      await root.configure({ gl, shadows, frameloop: "never", size: { width: 1440, height: 900, top: 0, left: 0 }, dpr: 1 });
      assert.equal(gl.shadowMap.enabled, initialTier.shadows !== false, initialTier.tier);
      assert.equal(gl.shadowMap.type, PCFShadowMap, `${initialTier.tier}: no removed mode, including before a future upgrade`);
    } finally { _roots.delete(canvas); }
  }
});
