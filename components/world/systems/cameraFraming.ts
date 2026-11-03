import { PerspectiveCamera, Vector3, type Camera } from "three";

const localPlayer = new Vector3();

/** Apply the follow aim after camera obstruction and damping have settled this frame. */
export function aimFollowCamera(camera: Camera, lookAt: Vector3, player: Vector3): void {
  camera.lookAt(lookAt);
  if (!(camera instanceof PerspectiveCamera)) return;
  camera.updateMatrixWorld(true);
  localPlayer.copy(player).applyMatrix4(camera.matrixWorldInverse);
  if (localPlayer.z >= 0) return;
  // Obstruction can shorten the camera distance while its aim remains several metres
  // above the lantern. Tilt only as far as needed to leave 11% below the player's base.
  const angle = Math.atan2(localPlayer.y, -localPlayer.z);
  const lowerLimit = Math.atan(-0.78 * Math.tan(camera.getEffectiveFOV() * Math.PI / 360));
  if (angle < lowerLimit) {
    camera.rotateX(angle - lowerLimit);
    camera.updateMatrixWorld(true);
  }
}
