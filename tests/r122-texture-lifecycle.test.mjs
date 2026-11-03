import test from "node:test";
import assert from "node:assert/strict";
import { BufferGeometry, MeshBasicMaterial, Texture } from "three";
import { WebGLProperties } from "three/src/renderers/webgl/WebGLProperties.js";
import { trackRendererResources } from "../components/world/systems/textureLifecycle.ts";

test("R12.2-D shared textures release each retired renderer and keep reusable image data",()=>{
  const image={width:1,height:1},shared=new Texture(image);
  const active=new Set();
  for(let cycle=0;cycle<4;cycle++) {
    const properties=new WebGLProperties(),original=properties.get;
    const release=trackRendererResources({properties,renderBufferDirect(){}});
    const record=properties.get(shared);
    assert.equal(record,properties.get(shared),"normal renderer property identity is preserved");
    // Three subscribes the renderer when a texture first receives GPU storage.
    const onDispose=()=>{active.delete(cycle);shared.removeEventListener("dispose",onDispose);properties.remove(shared);};
    shared.addEventListener("dispose",onDispose);active.add(cycle);
    release();
    assert.equal(active.size,0,"cached texture must not retain a retired renderer");
    assert.equal(shared._listeners.dispose.length,0);
    assert.equal(properties.get,original);
    assert.equal(shared.image,image,"teardown must preserve decoded data for the next renderer");
  }
});

test("R12.2-D early disposal removes temporary textures from teardown ownership",()=>{
  const properties=new WebGLProperties(),release=trackRendererResources({properties,renderBufferDirect(){}});
  const temporary=new Texture(),unused=new Texture();
  let disposed=0,unusedDisposed=0;
  temporary.addEventListener("dispose",()=>disposed++);
  unused.addEventListener("dispose",()=>unusedDisposed++);
  const material={};assert.equal(properties.get(material),properties.get(material));
  properties.get(temporary);
  temporary.dispose();
  release();
  assert.equal(disposed,1,"already retired temporary textures must not be retained and disposed again");
  assert.equal(unusedDisposed,0,"textures this renderer never used remain untouched");
});

test("R12.2-D shared draw geometry and material release retired renderer subscriptions",()=>{
  const geometry=new BufferGeometry(),material=new MeshBasicMaterial();
  for(let cycle=0;cycle<3;cycle++) {
    const retained=new Set(),properties=new WebGLProperties();
    const draw=function(camera,scene,g,m,object,group) {
      assert.equal(this,renderer,"renderer call binding must be preserved");
      assert.equal(camera,"camera");assert.equal(scene,"scene");assert.equal(object,"mesh");assert.equal(group,"group");
      for(const resource of [g,m]) {
        if(retained.has(resource))continue;
        retained.add(resource);
        const onDispose=()=>{retained.delete(resource);resource.removeEventListener("dispose",onDispose);};
        resource.addEventListener("dispose",onDispose);
      }
    };
    const renderer={properties,renderBufferDirect:draw};
    const release=trackRendererResources(renderer);
    renderer.renderBufferDirect("camera","scene",geometry,material,"mesh","group");
    release();
    assert.equal(retained.size,0,"shared geometry/material must not retain prior renderers");
    assert.equal(renderer.renderBufferDirect,draw);
  }
});
