import type { DatabaseSync } from "node:sqlite";

// Стартовый каталог на позициях из прайса AGE UZ (10.11.2026).
// Коды совпадают с прайсом: после загрузки свежего прайса цены и наличие обновятся сами.
// У позиций без артикула в прайсе кодом служит полное наименование.

type C = {
  code: string;
  cat: string;
  name: string; // название на сайте
  priceName: string; // как в прайсе AGE
  usd: number;
  brand: string;
  img: string;
  specs: Record<string, string>;
};

const P = "/img/parts/";

const COMPONENTS: C[] = [
  // Процессоры
  { code: "i5-12400", cat: "cpu", name: "Intel Core i5-12400 OEM", priceName: "Intel-Core i5 - 12400, 2.7 GHz, 18MB, oem, LGA1700, Alder Lake", usd: 140, brand: "Intel", img: "intel-i5.png", specs: { socket: "LGA1700", cores: "6/12", tdp: "65", igpu: "да" } },
  { code: "i3-14100F", cat: "cpu", name: "Intel Core i3-14100F OEM", priceName: "Intel-Core i3 - 14100F, 2.5 GHz, 12MB, oem, LGA1700, Raptor Lake", usd: 87, brand: "Intel", img: "intel-i3.png", specs: { socket: "LGA1700", cores: "4/8", tdp: "58", igpu: "нет" } },
  { code: "i5-12400F", cat: "cpu", name: "Intel Core i5-12400F OEM", priceName: "Intel-Core i5 - 12400F, 2.7 GHz, 18MB, oem, LGA1700, Alder Lake", usd: 110, brand: "Intel", img: "intel-i5.png", specs: { socket: "LGA1700", cores: "6/12", tdp: "65", igpu: "нет" } },
  { code: "i5-14600KF", cat: "cpu", name: "Intel Core i5-14600KF OEM", priceName: "Intel-Core i5 - 14600KF, 3.5 GHz, 24MB, oem, LGA1700, Raptor Lake", usd: 205, brand: "Intel", img: "intel-i5.png", specs: { socket: "LGA1700", cores: "14/20", tdp: "125", igpu: "нет" } },
  { code: "100-000000597", cat: "cpu", name: "AMD Ryzen 5 7500F OEM", priceName: "AMD Ryzen™ 5 Raphael 7500F - 3.7 GHz, 6 cores/12 threads, No GPU, AM5 (100-000000597)", usd: 118, brand: "AMD", img: "ryzen-7500f.jpg", specs: { socket: "AM5", cores: "6/12", tdp: "65", igpu: "нет" } },
  { code: "100-000000910", cat: "cpu", name: "AMD Ryzen 7 7800X3D OEM", priceName: "AMD Ryzen™ 7 Raphael 7800X3D - 4.2 GHz, 8 cores/16 threads, GPU, AM5 (100-000000910), oem", usd: 268, brand: "AMD", img: "ryzen-7800x3d.jpg", specs: { socket: "AM5", cores: "8/16", tdp: "120", igpu: "да" } },
  { code: "100-000001084", cat: "cpu", name: "AMD Ryzen 7 9800X3D OEM", priceName: "AMD Ryzen™ 7 Granite Ridge 9800X3D - 4.7 Ghz, 8 cores/16 threads, GPU, AM5, (100-000001084), oem", usd: 395, brand: "AMD", img: "ryzen-9800x3d.jpg", specs: { socket: "AM5", cores: "8/16", tdp: "120", igpu: "да" } },
  { code: "100-000000719", cat: "cpu", name: "AMD Ryzen 9 9950X3D OEM", priceName: "AMD Ryzen™ 9 Granite Ridge 9950X3D - 4.3 Ghz, 16 cores/32 threads, GPU, AM5, (100-000000719), oem", usd: 610, brand: "AMD", img: "ryzen-9950x3d.jpg", specs: { socket: "AM5", cores: "16/32", tdp: "170", igpu: "да" } },

  // Материнские платы
  { code: "911-7D46-228", cat: "mb", name: "MSI PRO H610M-G DDR4", priceName: "MB MSI PRO H610M-G DDR4 LGA1700 (можно подключить несколько мониторов)", usd: 74, brand: "MSI", img: "mb-msi-h610m-g.jpg", specs: { socket: "LGA1700", ram_type: "DDR4", form_factor: "mATX" } },
  { code: "GA-B760M-H-D4", cat: "mb", name: "Gigabyte B760M H DDR4", priceName: "MB Gigabyte B760M H DDR4 LGA1700", usd: 79, brand: "Gigabyte", img: "mb-gb-b760m-h.jpg", specs: { socket: "LGA1700", ram_type: "DDR4", form_factor: "mATX" } },
  { code: "911-7E27-007", cat: "mb", name: "MSI PRO B650M-P", priceName: "MB MSI AMD AM5 PRO B650M-P DDR5", usd: 110, brand: "MSI", img: "mb-msi-b650m-p.jpg", specs: { socket: "AM5", ram_type: "DDR5", form_factor: "mATX" } },
  { code: "911-7D99-060", cat: "mb", name: "MSI B760M GAMING PLUS WIFI DDR5", priceName: "MB MSI B760M GAMING PLUS WIFI DDR5 LGA1700", usd: 140, brand: "MSI", img: "mb-msi-b760m-gp.jpg", specs: { socket: "LGA1700", ram_type: "DDR5", form_factor: "mATX" } },
  { code: "911-7E56-014", cat: "mb", name: "MSI B850 GAMING PLUS WIFI", priceName: "MB MSI AMD AM5 B850 GAMING PLUS WIFI DDR5", usd: 220, brand: "MSI", img: "mb-msi-b850-gp.jpg", specs: { socket: "AM5", ram_type: "DDR5", form_factor: "ATX" } },
  { code: "GA-X870-EAGLE-WF7", cat: "mb", name: "Gigabyte X870 EAGLE WIFI7", priceName: "MB Gigabyte AMD AM5 X870 EAGLE WIFI7 DDR5", usd: 250, brand: "Gigabyte", img: "mb-gb-x870-eagle.jpg", specs: { socket: "AM5", ram_type: "DDR5", form_factor: "ATX" } },
  { code: "911-7E59-006", cat: "mb", name: "MSI MAG X870E TOMAHAWK WIFI", priceName: "MB MSI AMD AM5 MAG X870E TOMAHAWK WIFI DDR5", usd: 350, brand: "MSI", img: "mb-msi-x870e-tomahawk.jpg", specs: { socket: "AM5", ram_type: "DDR5", form_factor: "ATX" } },

  // Оперативная память
  { code: "Lexar DDR4 16GB 3200MHz", cat: "ram", name: "Lexar 16GB DDR4-3200", priceName: "Lexar DDR4 16GB 3200MHz", usd: 120, brand: "Lexar", img: "ram-lexar-ddr4.webp", specs: { ram_type: "DDR4", capacity: "16 ГБ", speed: "3200 МГц" } },
  { code: "Teamgroup DDR4 16GB 3600MHz (8*2) RGB", cat: "ram", name: "Teamgroup T-Force Delta RGB 16GB (2×8) DDR4-3600", priceName: "Teamgroup DDR4 16GB 3600MHz (8*2) RGB", usd: 134, brand: "Teamgroup", img: "ram-tg-delta-ddr4.jpg", specs: { ram_type: "DDR4", capacity: "16 ГБ (2×8)", speed: "3600 МГц" } },
  { code: "KingBank DDR5 32GB 6000MHz 16GB*2 Longdimm Black Heatsink DRAM (C36)", cat: "ram", name: "KingBank 32GB (2×16) DDR5-6000 CL36", priceName: "KingBank DDR5 32GB 6000MHz 16GB*2 Longdimm Black Heatsink DRAM (C36)", usd: 530, brand: "KingBank", img: "", specs: { ram_type: "DDR5", capacity: "32 ГБ (2×16)", speed: "6000 МГц" } },
  { code: "Teamgroup DDR5 32GB 6000MHz (16*2) RGB", cat: "ram", name: "Teamgroup T-Force Delta RGB 32GB (2×16) DDR5-6000", priceName: "Teamgroup DDR5 32GB 6000MHz (16*2) RGB", usd: 550, brand: "Teamgroup", img: "ram-tg-delta-ddr5.jpg", specs: { ram_type: "DDR5", capacity: "32 ГБ (2×16)", speed: "6000 МГц" } },
  { code: "Teamgroup DDR5 64GB 6000MHz (32*2) RGB", cat: "ram", name: "Teamgroup T-Force Delta RGB 64GB (2×32) DDR5-6000", priceName: "Teamgroup DDR5 64GB 6000MHz (32*2) RGB", usd: 1050, brand: "Teamgroup", img: "ram-tg-delta-ddr5.jpg", specs: { ram_type: "DDR5", capacity: "64 ГБ (2×32)", speed: "6000 МГц" } },

  // Видеокарты
  { code: "GV-N3050WF2OCV2-8GD", cat: "gpu", name: "Gigabyte GeForce RTX 3050 WINDFORCE OC V2 8GB", priceName: "Gigabyte - 8GB GeForce RTX3050 WINDFORCE OC V2 GV-N3050WF2OCV2-8GD", usd: 285, brand: "Gigabyte", img: "gpu-gb-3050.jpg", specs: { vram: "8 ГБ", tdp: "130" } },
  { code: "NE75060V19P1-GB2063L", cat: "gpu", name: "Palit GeForce RTX 5060 Infinity 2 OC 8GB", priceName: "Palit - 8GB GeForce RTX5060 INFINITY 2 OC GDDR7 128bit 3-DP HDMI (NE75060V19P1-GB2051L)", usd: 490, brand: "Palit", img: "gpu-palit-5060.png", specs: { vram: "8 ГБ", tdp: "145" } },
  { code: "912-V535-003", cat: "gpu", name: "MSI GeForce RTX 5060 Ti SHADOW 2X OC PLUS 16GB", priceName: "MSI - 16GB GeForce RTX5060Ti SHADOW 2X OC PLUS (912-V535-003)", usd: 850, brand: "MSI", img: "gpu-msi-5060ti.webp", specs: { vram: "16 ГБ", tdp: "180" } },
  { code: "NE75070S19K9-GB2050S", cat: "gpu", name: "Palit GeForce RTX 5070 Infinity 3 OC 12GB", priceName: "Palit - 12GB GeForce RTX5070 INFINITY 3 OC GDDR7 192bit 3-DP HDMI (NE75070S19K9-GB2050S)", usd: 930, brand: "Palit", img: "gpu-palit-5070.png", specs: { vram: "12 ГБ", tdp: "250" } },
  { code: "Gigabyte - 16GB GeForce RTX5070Ti WINDFORCE OC GV-N507TWF3OC-16GD", cat: "gpu", name: "Gigabyte GeForce RTX 5070 Ti WINDFORCE OC 16GB", priceName: "Gigabyte - 16GB GeForce RTX5070Ti WINDFORCE OC GV-N507TWF3OC-16GD", usd: 1400, brand: "Gigabyte", img: "gpu-gb-5070ti.jpg", specs: { vram: "16 ГБ", tdp: "300" } },
  { code: "NE75080S19T2-GB2031A", cat: "gpu", name: "Palit GeForce RTX 5080 Infinity 3 OC 16GB", priceName: "Palit - 16GB GeForce RTX5080 INFINITY 3 OC GDDR7 256bit 3-DP HDMI (NE75080U19T2-GB2035S)", usd: 1900, brand: "Palit", img: "gpu-palit-5080.png", specs: { vram: "16 ГБ", tdp: "360" } },
  { code: "Gigabyte - 16GB GeForce RTX5080 GAMING OC DDR7 GV-N5080GAMING OC-16GD", cat: "gpu", name: "Gigabyte GeForce RTX 5080 GAMING OC 16GB", priceName: "Gigabyte - 16GB GeForce RTX5080 GAMING OC DDR7 GV-N5080GAMING OC-16GD", usd: 1900, brand: "Gigabyte", img: "gpu-gb-5080.jpg", specs: { vram: "16 ГБ", tdp: "360" } },

  // SSD
  { code: "SSD M.2 Hiksemi 512GB NVMe", cat: "ssd", name: "Hiksemi 512GB M.2 NVMe", priceName: "SSD M.2 Hiksemi 512GB NVMe", usd: 66, brand: "Hiksemi", img: "", specs: { capacity: "512 ГБ" } },
  { code: "SSD M2 Kingston 1TB NVMe NV3", cat: "ssd", name: "Kingston NV3 1TB M.2 NVMe", priceName: "SSD M2 Kingston 1TB NVMe NV3", usd: 140, brand: "Kingston", img: "ssd-kingston-nv3.jpg", specs: { capacity: "1 ТБ" } },
  { code: "S78-440L0J0-P83", cat: "ssd", name: "MSI SPATIUM M470 PRO 1TB M.2 NVMe", priceName: "SSD M.2 MSI 1000GB SPATIUM M470 PRO 6000MB/s NVMe (S78-440L0J0-P83)", usd: 205, brand: "MSI", img: "ssd-msi-m470.jpg", specs: { capacity: "1 ТБ" } },
  { code: "MZ-V9P1T0B/AM", cat: "ssd", name: "Samsung 990 PRO 1TB M.2 NVMe", priceName: "SSD M.2 Samsung 1TB 990 PRO NVMe M.2", usd: 222, brand: "Samsung", img: "ssd-samsung-990pro.jpg", specs: { capacity: "1 ТБ" } },
  { code: "S78-440Q550-P83", cat: "ssd", name: "MSI SPATIUM M461 2TB M.2 NVMe", priceName: "SSD M.2 MSI 2000GB SPATIUM M461 4200MB/s NVMe (S78-440Q550-P83)", usd: 305, brand: "MSI", img: "ssd-msi-m461.jpg", specs: { capacity: "2 ТБ" } },

  // Блоки питания
  { code: "Блок питание Deepcool PF550 (550W, 80+, APFC, 20+4 pin)", cat: "psu", name: "DeepCool PF550 550W 80+", priceName: "Блок питание Deepcool PF550 (550W, 80+, APFC, 20+4 pin)", usd: 33, brand: "DeepCool", img: "psu-dc-pf550.webp", specs: { wattage: "550", cert: "80+" } },
  { code: "R-PL650D-FC0B-WDEU", cat: "psu", name: "DeepCool PL650D 650W 80+ Bronze", priceName: "Блок питание Deepcool PL650D (650W, 80+ Bronze, APFC, 20+4 pin)", usd: 57, brand: "DeepCool", img: "psu-dc-pl650d.webp", specs: { wattage: "650", cert: "80+ Bronze" } },
  { code: "R-PL750D-FC0B-EU", cat: "psu", name: "DeepCool PL750D 750W 80+ Bronze", priceName: "Блок питание Deepcool PL750D (750W, 80+ Bronze, APFC, 20+4 pin)", usd: 68, brand: "DeepCool", img: "psu-dc-pl750d.webp", specs: { wattage: "750", cert: "80+ Bronze" } },
  { code: "Блок питание - MSI MAG A750GL PCIE5, 80 Plus Gold, Modular, 750 Watt", cat: "psu", name: "MSI MAG A750GL PCIE5 750W 80+ Gold", priceName: "Блок питание - MSI MAG A750GL PCIE5, 80 Plus Gold, Modular, 750 Watt", usd: 95, brand: "MSI", img: "psu-msi-a750gl.webp", specs: { wattage: "750", cert: "80+ Gold" } },
  { code: "Блок питание - MSI MAG A850GL PCIE5, 80 Plus Gold, Modular, 850 Watt", cat: "psu", name: "MSI MAG A850GL PCIE5 850W 80+ Gold", priceName: "Блок питание - MSI MAG A850GL PCIE5, 80 Plus Gold, Modular, 850 Watt", usd: 110, brand: "MSI", img: "psu-msi-a850gl.jpg", specs: { wattage: "850", cert: "80+ Gold" } },
  { code: "Блок питание - MSI MAG A1000GL PCIE5, 80 PLUS Gold, 1000W Modular", cat: "psu", name: "MSI MAG A1000GL PCIE5 1000W 80+ Gold", priceName: "Блок питание - MSI MAG A1000GL PCIE5, 80 PLUS Gold, 1000W Modular", usd: 140, brand: "MSI", img: "psu-msi-a1000gl.jpg", specs: { wattage: "1000", cert: "80+ Gold" } },
  { code: "HG2-1200-G5T", cat: "psu", name: "FSP Hydro G PRO 1200W 80+ Gold", priceName: "FSP HYDRO G Pro 1200W Power Supply, 80 Plus Gold  (HG2-1200-G5T)", usd: 195, brand: "FSP", img: "psu-fsp-hg2-1200.jpg", specs: { wattage: "1200", cert: "80+ Gold" } },

  // Корпуса
  { code: "R-CH160-BKNGM0-G", cat: "case", name: "DeepCool CH160 PLUS", priceName: "Корпус Deepcool CH160 PLUS", usd: 48, brand: "DeepCool", img: "case-dc-ch160.webp", specs: { form_factor: "mATX, ITX" } },
  { code: "R-CC550BKANA4-G", cat: "case", name: "DeepCool CC550 4F", priceName: "Корпус Deepcool CC550 4F", usd: 32, brand: "DeepCool", img: "case-dc-cc550.webp", specs: { form_factor: "ATX, mATX, ITX" } },
  { code: "R-CG380-BKAGM3-G", cat: "case", name: "DeepCool CG380 3F", priceName: "Корпус Deepcool CG380 3F", usd: 48, brand: "DeepCool", img: "case-dc-cg380.webp", specs: { form_factor: "mATX, ITX" } },
  { code: "R-CG580-BKADA4-G-2", cat: "case", name: "DeepCool CG580 4F V2", priceName: "Корпус Deepcool CG580 4F V2", usd: 63, brand: "DeepCool", img: "case-dc-cg580.webp", specs: { form_factor: "ATX, mATX, ITX" } },
  { code: "306-7G24R25-HH9", cat: "case", name: "MSI MAG PANO M100R PZ", priceName: "Корпус MSI MAG PANO M100R PZ", usd: 76, brand: "MSI", img: "case-msi-pano-m100r.webp", specs: { form_factor: "mATX, ITX" } },
  { code: "G99.LAN2MRX.50", cat: "case", name: "Lian Li LANCOOL II Mesh RGB Black", priceName: "Корпус Lian Li LANCOOL II Mesh C RGB-X Black", usd: 100, brand: "Lian Li", img: "case-ll-lancool2.jpg", specs: { form_factor: "E-ATX, ATX, mATX, ITX" } },
  { code: "G99.O11DEXL-X.00", cat: "case", name: "Lian Li O11 Dynamic EVO XL Black", priceName: "Корпус Lian Li O11 Dynamic EVO XL black", usd: 220, brand: "Lian Li", img: "case-ll-o11-evo-xl.jpg", specs: { form_factor: "E-ATX, ATX, mATX, ITX" } },

  // Охлаждение
  { code: "R-AG400-BKNPMG2-G", cat: "cooler", name: "DeepCool AG400 G2", priceName: "Кулер Deepcool AG400 G2", usd: 18, brand: "DeepCool", img: "cool-dc-ag400g2.webp", specs: { type: "Башня, 120 мм" } },
  { code: "R-AK400-BKADMN-GJD", cat: "cooler", name: "DeepCool AK400 DIGITAL SE", priceName: "Кулер Deepcool AK400 DIGITAL SE", usd: 27, brand: "DeepCool", img: "cool-dc-ak400dse.webp", specs: { type: "Башня с дисплеем" } },
  { code: "R-AK500G2-BKNNMN-GJD", cat: "cooler", name: "DeepCool AK500 G2", priceName: "Кулер Deepcool AK500 G2", usd: 53, brand: "DeepCool", img: "cool-dc-ak500g2.webp", specs: { type: "Башня, 5 тепловых трубок" } },
  { code: "R-LT360VISION-BKAMMC-G-1", cat: "cooler", name: "DeepCool LT360 VISION ARGB", priceName: "Водяной кулер Deepcool LT360 VISION ARGB", usd: 105, brand: "DeepCool", img: "cool-dc-lt360v.webp", specs: { type: "СЖО 360 с LCD 4.5\"" } },
  { code: "R-LQ360-BKASMC-G-1", cat: "cooler", name: "DeepCool LQ360 ULTRA ARGB", priceName: "Водяной кулер Deepcool  LQ360 ULTRA ARGB", usd: 110, brand: "DeepCool", img: "cool-dc-lq360u.webp", specs: { type: "СЖО 360" } },
  { code: "L-P360A-AS3M-G1K", cat: "cooler", name: "TRYX PANORAMA 360 ARGB Black", priceName: "Водяной кулер TRYX PANORAMA 360mm AIO Liquid Cooler ARGB Black", usd: 370, brand: "TRYX", img: "", specs: { type: "СЖО 360 с AMOLED-экраном" } },
];

type B = {
  slug: string;
  name: string;
  tagline: string;
  purpose: string;
  fps: string;
  featured: number;
  parts: [code: string, qty?: number][];
  description: string;
};

const BUILDS: B[] = [
  {
    slug: "ofis",
    name: "Офис",
    tagline: "Тихий ПК для учёбы, документов и 1С",
    purpose: "office",
    fps: "",
    featured: 0,
    parts: [["i5-12400"], ["911-7D46-228"], ["Lexar DDR4 16GB 3200MHz"], ["SSD M.2 Hiksemi 512GB NVMe"], ["Блок питание Deepcool PF550 (550W, 80+, APFC, 20+4 pin)"], ["R-CH160-BKNGM0-G"], ["R-AG400-BKNPMG2-G"]],
    description: "6 ядер Intel со встроенной графикой, быстрый NVMe-накопитель и компактный корпус. Без лишнего шума — для работы и учёбы.",
  },
  {
    slug: "start",
    name: "Старт",
    tagline: "Входной билет в Full HD гейминг",
    purpose: "gaming",
    fps: "CS2 — 200+ FPS, Dota 2 — 140+ FPS, Valorant — 250+ FPS (1080p)",
    featured: 0,
    parts: [["i3-14100F"], ["911-7D46-228"], ["Teamgroup DDR4 16GB 3600MHz (8*2) RGB"], ["GV-N3050WF2OCV2-8GD"], ["SSD M.2 Hiksemi 512GB NVMe"], ["R-PL650D-FC0B-WDEU"], ["R-CC550BKANA4-G"], ["R-AG400-BKNPMG2-G"]],
    description: "Бюджетная игровая сборка для киберспортивных дисциплин в Full HD. Корпус с четырьмя ARGB-вентиляторами в комплекте.",
  },
  {
    slug: "balans",
    name: "Баланс",
    tagline: "Популярные игры на высоких в 1080p",
    purpose: "gaming",
    fps: "CS2 — 300+ FPS, Warzone — 110+ FPS, Cyberpunk 2077 — 75+ FPS (1080p, DLSS)",
    featured: 0,
    parts: [["i5-12400F"], ["GA-B760M-H-D4"], ["Teamgroup DDR4 16GB 3600MHz (8*2) RGB"], ["NE75060V19P1-GB2063L"], ["SSD M2 Kingston 1TB NVMe NV3"], ["R-PL650D-FC0B-WDEU"], ["R-CG380-BKAGM3-G"], ["R-AK400-BKADMN-GJD"]],
    description: "RTX 5060 с DLSS 4 и проверенный i5-12400F — оптимальное соотношение цены и FPS. Панорамный корпус CG380.",
  },
  {
    slug: "optima",
    name: "Оптима",
    tagline: "Хит продаж: AM5 и 16 ГБ видеопамяти",
    purpose: "gaming",
    fps: "CS2 — 400+ FPS, Warzone — 140+ FPS, Cyberpunk 2077 — 85+ FPS (1440p, DLSS)",
    featured: 1,
    parts: [["100-000000597"], ["911-7E27-007"], ["KingBank DDR5 32GB 6000MHz 16GB*2 Longdimm Black Heatsink DRAM (C36)"], ["912-V535-003"], ["SSD M2 Kingston 1TB NVMe NV3"], ["R-PL750D-FC0B-EU"], ["R-CG580-BKADA4-G-2"], ["R-AK400-BKADMN-GJD"]],
    description: "Платформа AM5 с запасом под апгрейд, 32 ГБ DDR5 и RTX 5060 Ti с 16 ГБ памяти — комфортно в 1440p.",
  },
  {
    slug: "streamer",
    name: "Стример",
    tagline: "Игра и трансляция с одного ПК",
    purpose: "stream",
    fps: "Fortnite — 200+ FPS + стрим 1080p60 через NVENC",
    featured: 0,
    parts: [["i5-14600KF"], ["911-7D99-060"], ["Teamgroup DDR5 32GB 6000MHz (16*2) RGB"], ["NE75070S19K9-GB2050S"], ["S78-440L0J0-P83"], ["Блок питание - MSI MAG A750GL PCIE5, 80 Plus Gold, Modular, 750 Watt"], ["306-7G24R25-HH9"], ["R-AK500G2-BKNNMN-GJD"]],
    description: "14 ядер для OBS и кодирования, RTX 5070 для игры и аппаратного энкодера, Wi-Fi на плате.",
  },
  {
    slug: "pro",
    name: "Про",
    tagline: "Лучший игровой процессор и RTX 5070 Ti",
    purpose: "gaming",
    fps: "CS2 — 600+ FPS, Cyberpunk 2077 — 120+ FPS (1440p, DLSS + FG)",
    featured: 1,
    parts: [["100-000000910"], ["911-7E56-014"], ["Teamgroup DDR5 32GB 6000MHz (16*2) RGB"], ["Gigabyte - 16GB GeForce RTX5070Ti WINDFORCE OC GV-N507TWF3OC-16GD"], ["MZ-V9P1T0B/AM"], ["Блок питание - MSI MAG A850GL PCIE5, 80 Plus Gold, Modular, 850 Watt"], ["G99.LAN2MRX.50"], ["R-LT360VISION-BKAMMC-G-1"]],
    description: "Ryzen 7 7800X3D с 3D V-Cache — максимум FPS в соревновательных играх. СЖО с 4.5-дюймовым экраном.",
  },
  {
    slug: "ultra",
    name: "Ультра",
    tagline: "4K без компромиссов",
    purpose: "gaming",
    fps: "Cyberpunk 2077 — 100+ FPS (4K, DLSS + FG), Warzone — 200+ FPS (1440p)",
    featured: 1,
    parts: [["100-000001084"], ["GA-X870-EAGLE-WF7"], ["Teamgroup DDR5 32GB 6000MHz (16*2) RGB"], ["NE75080S19T2-GB2031A"], ["S78-440Q550-P83"], ["Блок питание - MSI MAG A1000GL PCIE5, 80 PLUS Gold, 1000W Modular"], ["G99.O11DEXL-X.00"], ["R-LQ360-BKASMC-G-1"]],
    description: "Ryzen 7 9800X3D и RTX 5080 в панорамном Lian Li O11 Dynamic EVO XL с водяным охлаждением.",
  },
  {
    slug: "monstr",
    name: "Монстр",
    tagline: "Флагман для 3D, нейросетей и 4K-гейминга",
    purpose: "work",
    fps: "Любые игры в 4K на ультра, рендер в Blender и Premiere в разы быстрее",
    featured: 0,
    parts: [["100-000000719"], ["911-7E59-006"], ["Teamgroup DDR5 64GB 6000MHz (32*2) RGB"], ["Gigabyte - 16GB GeForce RTX5080 GAMING OC DDR7 GV-N5080GAMING OC-16GD"], ["S78-440Q550-P83", 2], ["HG2-1200-G5T"], ["G99.O11DEXL-X.00"], ["L-P360A-AS3M-G1K"]],
    description: "16 ядер Ryzen 9 9950X3D, 64 ГБ DDR5, RTX 5080 и 4 ТБ NVMe — для тех, кому нужно всё и сразу.",
  },
];

export function seedDemo(db: DatabaseSync) {
  db.exec("BEGIN");
  try {
    const pi = db.prepare("INSERT OR IGNORE INTO price_items(code, name, price, stock, in_stock, category) VALUES (?, ?, ?, 'есть', 1, ?)");
    const ci = db.prepare("INSERT INTO components(category, name, brand, price_code, specs, image) VALUES (?, ?, ?, ?, ?, ?)");
    const ids = new Map<string, number>();
    for (const c of COMPONENTS) {
      pi.run(c.code, c.priceName, c.usd, null);
      const r = ci.run(c.cat, c.name, c.brand, c.code, JSON.stringify(c.specs), c.img ? P + c.img : null);
      ids.set(c.code, Number(r.lastInsertRowid));
    }
    const bi = db.prepare(
      "INSERT INTO builds(slug, name, tagline, description, purpose, fps, featured, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const bii = db.prepare("INSERT INTO build_items(build_id, component_id, qty) VALUES (?, ?, ?)");
    BUILDS.forEach((b, idx) => {
      const r = bi.run(b.slug, b.name, b.tagline, b.description, b.purpose, b.fps, b.featured, (idx + 1) * 10);
      const id = Number(r.lastInsertRowid);
      for (const [code, qty = 1] of b.parts) {
        const cid = ids.get(code);
        if (!cid) throw new Error(`seed: нет комплектующей ${code}`);
        bii.run(id, cid, qty);
      }
    });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
