// Узбекские тексты для стартовых сборок (заполняются миграцией, если поля пустые).
export const BUILDS_UZ: Record<string, { name: string; tagline: string; description: string; fps: string }> = {
  ofis: {
    name: "Ofis",
    tagline: "O'qish, hujjatlar va 1C uchun sokin kompyuter",
    description: "Integratsiyalashgan grafikali 6 yadroli Intel, tezkor NVMe disk va ixcham korpus. Ortiqcha shovqinsiz — ish va o'qish uchun.",
    fps: "",
  },
  start: {
    name: "Start",
    tagline: "Full HD o'yinlar olamiga kirish chiptasi",
    description: "Full HD formatdagi kibersport o'yinlari uchun hamyonbop o'yin yig'masi. To'plamda to'rtta ARGB ventilyatorli korpus.",
    fps: "CS2 — 200+ FPS, Dota 2 — 140+ FPS, Valorant — 250+ FPS (1080p)",
  },
  balans: {
    name: "Balans",
    tagline: "Mashhur o'yinlar 1080p da yuqori sozlamalarda",
    description: "DLSS 4 bilan RTX 5060 va sinovdan o'tgan i5-12400F — narx va FPS ning optimal nisbati. CG380 panoramali korpus.",
    fps: "CS2 — 300+ FPS, Warzone — 110+ FPS, Cyberpunk 2077 — 75+ FPS (1080p, DLSS)",
  },
  optima: {
    name: "Optima",
    tagline: "Savdo xiti: AM5 va 16 GB videoxotira",
    description: "Yangilash uchun zaxirali AM5 platformasi, 32 GB DDR5 va 16 GB xotirali RTX 5060 Ti — 1440p da qulay.",
    fps: "CS2 — 400+ FPS, Warzone — 140+ FPS, Cyberpunk 2077 — 85+ FPS (1440p, DLSS)",
  },
  streamer: {
    name: "Strimer",
    tagline: "Bitta kompyuterda o'yin va translyatsiya",
    description: "OBS va kodlash uchun 14 yadro, o'yin va apparat enkoder uchun RTX 5070, platada Wi-Fi.",
    fps: "Fortnite — 200+ FPS + NVENC orqali 1080p60 strim",
  },
  pro: {
    name: "Pro",
    tagline: "Eng yaxshi o'yin protsessori va RTX 5070 Ti",
    description: "3D V-Cache texnologiyali Ryzen 7 7800X3D — raqobatbardosh o'yinlarda maksimal FPS. 4.5 dyuymli ekranli suyuq sovutish.",
    fps: "CS2 — 600+ FPS, Cyberpunk 2077 — 120+ FPS (1440p, DLSS + FG)",
  },
  ultra: {
    name: "Ultra",
    tagline: "Murosasiz 4K",
    description: "Lian Li O11 Dynamic EVO XL panoramali korpusida suyuq sovutish bilan Ryzen 7 9800X3D va RTX 5080.",
    fps: "Cyberpunk 2077 — 100+ FPS (4K, DLSS + FG), Warzone — 200+ FPS (1440p)",
  },
  monstr: {
    name: "Monstr",
    tagline: "3D, neyrotarmoqlar va 4K o'yinlar uchun flagman",
    description: "16 yadroli Ryzen 9 9950X3D, 64 GB DDR5, RTX 5080 va 4 TB NVMe — hammasi birdaniga kerak bo'lganlar uchun.",
    fps: "Har qanday o'yin 4K da ultra sozlamalarda, Blender va Premiere da render bir necha barobar tezroq",
  },
};
