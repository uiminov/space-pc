import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Цены читаются из SQLite синхронно на каждый запрос — кэш компонентов выключен,
  // чтобы обновление прайса сразу отражалось на сайте.
  cacheComponents: false,
  serverExternalPackages: ["exceljs", "sharp"],
  // статичные картинки (фото первого экрана, стартовые фото товаров) кэшируются в браузере на неделю
  async headers() {
    return [{ source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] }];
  },
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
