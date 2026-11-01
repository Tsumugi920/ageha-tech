"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  SRGBColorSpace,
  Scene,
  Texture,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { WORLD_COLORS } from "@/lib/world/constants";

/**
 * 场景环境写入（模块级命令式入口：scene 取自 useThree，组件内直接赋值
 * 会被 react-hooks/immutability 视为渲染期值突变——同 setCanvasCursor 口径）。
 */
function applySceneEnvironment(
  scene: Scene,
  environment: Texture,
  intensity: number,
): void {
  scene.environment = environment;
  scene.environmentIntensity = intensity;
}

function clearSceneEnvironment(scene: Scene): void {
  scene.environment = null;
}

/**
 * 环境反射（阶段 3 灯光调校，蓝图 §3.3「无实时反射」口径内）：
 * 用程序化等距柱状渐变（天空 → 地平线 → 冰海 + 东北向晨光亮斑）
 * 经 PMREM 生成 IBL 环境贴图挂到 scene.environment——金属 / 玻璃 /
 * transmission 材质由此获得一致的冰蓝反射，零外部 HDR、零实时开销
 * （一次性预滤波）。卸载时释放渲染目标 / 纹理 / 生成器。
 */
export function SceneEnvironment() {
  const gl = useThree((state) => state.gl) as WebGLRenderer;
  const scene = useThree((state) => state.scene) as Scene;

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    let texture: Texture | null = null;
    let pmrem: PMREMGenerator | null = null;
    let renderTarget: WebGLRenderTarget | null = null;

    if (ctx) {
      // 竖向渐变：天顶 → 天空顶色 → 地平线 → 冰海（供反射的宏观色结构）
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#5FA9E8");
      gradient.addColorStop(0.34, WORLD_COLORS.skyTop);
      gradient.addColorStop(0.52, WORLD_COLORS.skyHorizon);
      gradient.addColorStop(0.56, WORLD_COLORS.fog);
      gradient.addColorStop(1, WORLD_COLORS.sea);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 晨光亮斑（与 DirectionalLight 同方位：东北上空，微暖）
      const sun = ctx.createRadialGradient(400, 52, 4, 400, 52, 74);
      sun.addColorStop(0, "rgba(255,246,232,0.95)");
      sun.addColorStop(0.4, "rgba(255,246,232,0.4)");
      sun.addColorStop(1, "rgba(255,246,232,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 两条低位冷色带（冰面反照，让金属底面不至发黑）
      ctx.fillStyle = "rgba(198,226,246,0.5)";
      ctx.fillRect(0, 148, canvas.width, 26);
      ctx.fillStyle = "rgba(157,210,240,0.35)";
      ctx.fillRect(0, 196, canvas.width, 22);

      texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.mapping = EquirectangularReflectionMapping;
      pmrem = new PMREMGenerator(gl);
      renderTarget = pmrem.fromEquirectangular(texture);
      // 强度收敛：IBL 只做反射细节，不做第二光源（光照仍由三光制主导）
      applySceneEnvironment(scene, renderTarget.texture, 0.45);
    }

    return () => {
      clearSceneEnvironment(scene);
      renderTarget?.dispose();
      texture?.dispose();
      pmrem?.dispose();
    };
  }, [gl, scene]);

  return null;
}
