import type { DatabaseSync } from "node:sqlite";

// Сборки до 10 млн сум (добавлены 2026-11-11). Создаются один раз при запуске,
// если их ещё нет; комплектующие ищутся по названию из прайса AGE.
// После создания их можно свободно менять и удалять в админке — повторно не появятся.
const MARK = "seed_budget_builds_v1";

type Def = {
  slug: string;
  sort: number;
  purpose: string;
  ru: { name: string; tagline: string; description: string; fps: string };
  uz: { name: string; tagline: string; description: string; fps: string };
  parts: string[];
};

const DEFS: Def[] = [
  {
    slug: "uy",
    sort: 5,
    purpose: "office",
    ru: {
      name: "Дом",
      tagline: "Учёба, интернет, фильмы и офисные программы",
      description: "Недорогой и тихий компьютер для всей семьи: 4-ядерный Intel со встроенной графикой, 16 ГБ памяти и быстрый NVMe-накопитель.",
      fps: "",
    },
    uz: {
      name: "Uy",
      tagline: "O'qish, internet, filmlar va ofis dasturlari",
      description: "Butun oila uchun arzon va sokin kompyuter: integratsiyalashgan grafikali 4 yadroli Intel, 16 GB xotira va tezkor NVMe disk.",
      fps: "",
    },
    parts: [
      "Intel-Core i3 12100, 3.3 GHz, 12MB, oem, LGA1700, Alder Lake",
      "MSI PRO H610M-S DDR4 LGA1700",
      "Lexar 16GB DDR4-3200",
      "Hiksemi 512GB M.2 NVMe",
      "Deepcool PF450 (450W, 80+, APFC, 20+4 pin)",
      "DeepCool CC550 4F",
      "Deepcool GAMMA ARCHER V2",
    ],
  },
  {
    slug: "kiber-start",
    sort: 12,
    purpose: "gaming",
    ru: {
      name: "Кибер Старт",
      tagline: "Первый игровой: CS2, Dota 2, Valorant",
      description: "Самый доступный игровой компьютер: Intel i3 12-го поколения и GTX 1650 для киберспортивных игр в Full HD.",
      fps: "CS2 — 100+ FPS, Dota 2 — 90+ FPS, Valorant — 180+ FPS (1080p, низкие/средние)",
    },
    uz: {
      name: "Kiber Start",
      tagline: "Birinchi o'yin kompyuteri: CS2, Dota 2, Valorant",
      description: "Eng arzon o'yin kompyuteri: Full HD kibersport o'yinlari uchun 12-avlod Intel i3 va GTX 1650.",
      fps: "CS2 — 100+ FPS, Dota 2 — 90+ FPS, Valorant — 180+ FPS (1080p, past/o'rta)",
    },
    parts: [
      "Intel-Core i3 12100F, 3.3 GHz, 12MB, oem, LGA1700, Alder Lake",
      "MSI PRO H610M-S DDR4 LGA1700",
      "Lexar 16GB DDR4-3200",
      "Hiksemi 512GB M.2 NVMe",
      "Arktek 4GB GeForce GTX1650 128Bits GDDR6",
      "Deepcool PF450 (450W, 80+, APFC, 20+4 pin)",
      "DeepCool CC550 4F",
      "Deepcool AG300",
    ],
  },
  {
    slug: "esport",
    sort: 14,
    purpose: "gaming",
    ru: {
      name: "Эспорт",
      tagline: "6 ядер и GTX 1660 Super для высоких FPS",
      description: "6-ядерный Ryzen 5 и GTX 1660 Super: уверенный Full HD в киберспорте и популярных онлайн-играх.",
      fps: "CS2 — 160+ FPS, Dota 2 — 130+ FPS, PUBG — 80+ FPS (1080p, средние)",
    },
    uz: {
      name: "Esport",
      tagline: "Yuqori FPS uchun 6 yadro va GTX 1660 Super",
      description: "6 yadroli Ryzen 5 va GTX 1660 Super: kibersport va mashhur onlayn o'yinlarda ishonchli Full HD.",
      fps: "CS2 — 160+ FPS, Dota 2 — 130+ FPS, PUBG — 80+ FPS (1080p, o'rta)",
    },
    parts: [
      "AMD Ryzen 5 Cezanne 5500 3.6 GHz, 6 cores/12 threads, No GPU, AM4 (100-000000457), oem",
      "Gigabyte AMD AM4 B550M DS3H R2 DDR4",
      "Lexar 16GB DDR4-3200",
      "Hiksemi 512GB M.2 NVMe",
      "Peladin 6GB GeForce GTX1660 Super 192Bits GDDR6",
      "MSI MAG A500DN, 80 PLUS Standard, 500 Watt Power Supply",
      "DeepCool CC550 4F",
      "DeepCool AG400 G2",
    ],
  },
  {
    slug: "kiber",
    sort: 16,
    purpose: "gaming",
    ru: {
      name: "Кибер",
      tagline: "RTX 3050 и i5 — лучший игровой до 10 млн",
      description: "Intel Core i5-12400F и GeForce RTX 3050 8 ГБ с поддержкой DLSS: киберспорт на высоких FPS и современные игры в Full HD.",
      fps: "CS2 — 180+ FPS, Dota 2 — 140+ FPS, PUBG — 90+ FPS (1080p, средние)",
    },
    uz: {
      name: "Kiber",
      tagline: "RTX 3050 va i5 — 10 mln gacha eng yaxshi o'yin kompyuteri",
      description: "Intel Core i5-12400F va DLSS qo'llab-quvvatlaydigan GeForce RTX 3050 8 GB: kibersportda yuqori FPS va zamonaviy o'yinlar Full HD da.",
      fps: "CS2 — 180+ FPS, Dota 2 — 140+ FPS, PUBG — 90+ FPS (1080p, o'rta)",
    },
    parts: [
      "Intel Core i5-12400F OEM",
      "MSI PRO H610M-S DDR4 LGA1700",
      "Lexar 16GB DDR4-3200",
      "Hiksemi 512GB M.2 NVMe",
      "Gigabyte GeForce RTX 3050 WINDFORCE OC V2 8GB",
      "MSI MAG A500DN, 80 PLUS Standard, 500 Watt Power Supply",
      "DeepCool CC550 4F",
      "DeepCool AG400 G2",
    ],
  },
];

export function seedBudgetBuilds(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM settings WHERE key = ?").get(MARK)) return;
  const findPart = db.prepare("SELECT id FROM components WHERE name = ? ORDER BY active DESC, id LIMIT 1");
  const hasSlug = db.prepare("SELECT 1 FROM builds WHERE slug = ?");
  const insBuild = db.prepare(
    `INSERT INTO builds(slug, name, tagline, description, purpose, fps, featured, active, sort, name_uz, tagline_uz, description_uz, fps_uz)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)`,
  );
  const insItem = db.prepare("INSERT OR IGNORE INTO build_items(build_id, component_id, qty) VALUES (?, ?, 1)");
  db.exec("BEGIN");
  try {
    for (const d of DEFS) {
      if (hasSlug.get(d.slug)) continue;
      const ids = d.parts.map((n) => (findPart.get(n) as { id: number } | undefined)?.id);
      if (ids.some((id) => id == null)) continue; // в этом прайсе нет нужной детали — пропускаем
      const r = insBuild.run(d.slug, d.ru.name, d.ru.tagline, d.ru.description, d.purpose, d.ru.fps, d.sort, d.uz.name, d.uz.tagline, d.uz.description, d.uz.fps);
      const bid = Number(r.lastInsertRowid);
      for (const id of ids) insItem.run(bid, id!);
    }
    db.prepare("INSERT INTO settings(key, value) VALUES (?, ?)").run(MARK, new Date().toISOString());
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
