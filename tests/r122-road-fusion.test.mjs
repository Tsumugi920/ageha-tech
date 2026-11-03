import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import * as ribbon from "../components/world/terrain/ribbonGeometry.ts";
import { TRAILS, NOOK_CORRIDOR, NOOK_CORRIDOR_SAMPLES } from "../lib/world/layout.ts";

test("R12.2-C default ribbon output remains byte-identical for existing trails and gallery", () => {
  const hash=createHash("sha256");
  const add=g=>{for(const a of [g.getAttribute("position").array,g.index.array,g.getAttribute("normal").array])hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));g.dispose();};
  for(const t of TRAILS)for(const [w,y,o]of[[t.width*1.16,.012,0],[t.width*.86,.045,0],[.24,.062,0],[.07,.055,-(t.width/2-.18)],[.07,.055,t.width/2-.18]])add(ribbon.buildRibbonGeometry(t.samples,w,y,o));
  for(const [w,y]of[[NOOK_CORRIDOR.width*1.15,-.26],[.4,-.24]])add(ribbon.buildRibbonGeometry(NOOK_CORRIDOR_SAMPLES,w,y));
  assert.equal(hash.digest("hex"),"c845a6951d304fc2816b1ac4ee2f3de79f45a069ba17ab4b685eba89aa81e58e");
});

const line=[{x:0,y:0,z:4},{x:0,y:0,z:0},{x:0,y:0,z:-4}];
test("R12.2-C cross-slope sampling prevents the road from bridging a terrain hollow", () => {
  const heightAt=x=>.4*x*x;
  const g=ribbon.buildRibbonGeometry(line,2.55,.055,0,heightAt,8);
  const material=new MeshBasicMaterial();
  try {
    const mesh=new Mesh(g,material);
    mesh.updateMatrixWorld(true);
    const ray=new Raycaster(new Vector3(0,3,-1),new Vector3(0,-1,0));
    const y=ray.intersectObject(mesh)[0].point.y;
    assert.ok(Math.abs(y-.055)<1e-5,`road center should follow the hollow + 0.055m, actual ${y}`);
    assert.equal(g.getAttribute("position").count,line.length*9);
    const p=g.getAttribute("position");
    for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-heightAt(p.getX(i))-.055)<1e-6);
  } finally {g.dispose();material.dispose();}
});

test("R12.2-C snow tint preserves all curb positions and fades at both ends", () => {
  assert.equal(typeof ribbon.addApproachSnowColor,"function");
  const g=ribbon.buildRibbonGeometry(Array.from({length:9},(_,i)=>({x:0,y:0,z:-i})),.18,.058,-1.305,x=>x*x*.1);
  try {
    const before=Array.from(g.getAttribute("position").array);
    ribbon.addApproachSnowColor(g,0);
    assert.deepEqual(Array.from(g.getAttribute("position").array),before);
    const colors=g.getAttribute("color");
    assert.equal(colors.count,g.getAttribute("position").count);
    assert.ok(colors.getX(8)>colors.getX(9),"outer snow edge must be lighter than the inner stone edge");
    for(let c=0;c<3;c++)assert.equal(colors.array[c],colors.array[colors.array.length-6+c]);
    assert.ok(Array.from(colors.array).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  } finally {g.dispose();}
});
