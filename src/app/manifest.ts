import type { MetadataRoute } from "next";

// Описание сайта как приложения: значок и название при «Добавить на главный экран» на телефоне
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SPACE PC",
    short_name: "SPACE PC",
    description: "Kompyuterlar va butlovchi qismlar — Toshkent",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1013",
    theme_color: "#0f1013",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
