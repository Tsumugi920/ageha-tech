import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Matrix4, PerspectiveCamera, Vector3 } from "three";
import { CAMERA_LIMITS } from "../lib/world/constants.ts";
import { SPAWN_POINT, BUTTERFLY_CORE } from "../lib/world/layout.ts";
import { MOBILE_MODIFIERS } from "../lib/world/performance.ts";
import { createSculptureWing, WING_HINGE } from "../components/world/objects/butterflySculpture.ts";

const wings = ["left", "right"].map(side => ({ side, ...createSculptureWing(side, BUTTERFLY_CORE.wingspan) }));
after(() => wings.forEach(wing => [wing.shell, wing.veins, wing.markings].forEach(g => g.dispose())));

for (const [width, height, mobile] of [[1440,900,false],[2560,1440,false],[390,844,true]]) {
  test(`R12.2-B ${width}×${height}: actual butterfly geometry clears the navigation and fits the viewport`, () => {
    const lookHeight = CAMERA_LIMITS.lookHeight ?? 1.1;
    const yaw = CAMERA_LIMITS.initialYaw;
    const pitch = CAMERA_LIMITS.initialPitch;
    const distance = CAMERA_LIMITS.distances[CAMERA_LIMITS.initialDistanceIndex] +
      (mobile ? MOBILE_MODIFIERS.cameraDistanceOffset : 0) + Math.max(0,1-width/height)*4.4;
    const look = new Vector3(SPAWN_POINT.x-Math.sin(yaw)*CAMERA_LIMITS.lookAhead, SPAWN_POINT.y+lookHeight, SPAWN_POINT.z-Math.cos(yaw)*CAMERA_LIMITS.lookAhead);
    const camera = new PerspectiveCamera(mobile ? CAMERA_LIMITS.fovMobile : CAMERA_LIMITS.fovDesktop,width/height,0.1,500);
    camera.position.copy(look).add(new Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(distance));
    camera.lookAt(look);
    camera.updateMatrixWorld(true);
    let top=Infinity,left=Infinity,right=-Infinity,bottom=-Infinity;
    const group = new Matrix4().makeTranslation(BUTTERFLY_CORE.center.x,BUTTERFLY_CORE.center.y,BUTTERFLY_CORE.center.z)
      .multiply(new Matrix4().makeRotationY(0.32));
    const point = new Vector3();
    for (const wing of wings) {
      const matrix = group.clone().multiply(new Matrix4().makeTranslation((wing.side==="left" ? -1 : 1)*WING_HINGE,0,0));
      const positions = wing.shell.getAttribute("position");
      for(let i=0;i<positions.count;i++) {
        point.fromBufferAttribute(positions,i).applyMatrix4(matrix).project(camera);
        const x=(point.x+1)*width/2,y=(1-point.y)*height/2;
        top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);
      }
    }
    assert.ok(top>=94,`butterfly top ${top.toFixed(1)}px must clear 82px navigation + 12px gap`);
    assert.ok(left>=0 && right<=width && bottom<=height,"complete wings must remain in the viewport");
  });
}

test("R12.2-B Canvas first pose and idle follow pose share the same height", () => {
  const lookY=SPAWN_POINT.y+(CAMERA_LIMITS.lookHeight??1.1);
  const cameraY=lookY+Math.sin(CAMERA_LIMITS.initialPitch)*CAMERA_LIMITS.distances[CAMERA_LIMITS.initialDistanceIndex];
  assert.ok(Math.abs(CAMERA_LIMITS.initialLookAt.y-lookY)<0.01);
  assert.ok(Math.abs(CAMERA_LIMITS.initialPosition.y-cameraY)<0.01,"first frame must not start below the follow pose");
});
