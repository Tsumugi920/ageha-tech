import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { aimFollowCamera } from "../components/world/systems/cameraFraming.ts";
import { CAMERA_LIMITS } from "../lib/world/constants.ts";

// Follow-camera obstruction contracts: positions come from the R12.2-D Moss arrival.
for (const [width,height] of [[1440,900],[390,844]]) {
  test(`R12.2-D ${width}x${height}: shortened follow camera keeps the player above the lower edge`,()=>{
    const camera=new PerspectiveCamera(width<768?64:58,width/height,.1,500);
    const player=new Vector3(44.3073585,-2.65,28.4241714);
    camera.position.set(44.5768459,1.2773465,24.8605003);
    const yaw=-3.8580302;
    const look=new Vector3(player.x-Math.sin(yaw)*CAMERA_LIMITS.lookAhead,player.y+CAMERA_LIMITS.lookHeight,player.z-Math.cos(yaw)*CAMERA_LIMITS.lookAhead);
    const originalPosition=camera.position.clone();
    aimFollowCamera(camera,look,player);
    camera.updateMatrixWorld(true);
    const projected=player.clone().project(camera);
    assert.ok(projected.y>=-.780001,`player NDC y ${projected.y} must stay above -0.78`);
    assert.ok(projected.z>-1&&projected.z<1);
    assert.deepEqual(camera.position,originalPosition,"framing must not undo obstruction placement");
  });
}

test("R12.2-D ordinary follow aim is unchanged, including the B homepage pose",()=>{
  for(const distance of [14,20]) {
    const player=new Vector3(6.5,.35,7),look=new Vector3(5.24555,3.05,4.95394);
    const original=new PerspectiveCamera(58,1.6,.1,500);
    original.position.copy(look).add(new Vector3(Math.sin(.55)*Math.cos(.18),Math.sin(.18),Math.cos(.55)*Math.cos(.18)).multiplyScalar(distance));
    original.lookAt(look);
    const candidate=original.clone();
    aimFollowCamera(candidate,look,player);
    assert.deepEqual(candidate.position,original.position);
    assert.deepEqual(candidate.quaternion.toArray(),original.quaternion.toArray());
  }
});
