import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静态导出：本站部署在 GitHub Pages（gh-pages 分支），构建直接产出 out/。
  output: "export",
};

export default nextConfig;
