import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint 平铺配置（Next 16 已移除 next lint，直接使用 eslint）。
 * - eslint-config-next/core-web-vitals：基础配置 + Next 核心规则
 * - eslint-config-next/typescript：typescript-eslint recommended + TS 规则微调
 */
const eslintConfig = [
  ...coreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "next-env.d.ts",
      ".zcode/**",
      "screenshots/**",
      "Discarded proposal/**",
    ],
  },
];

export default eslintConfig;
