import { PartIcon } from "./PartIcon";

// Единая рамка для фото товара на всём сайте.
// Пропорции задаёт рамка (className, по умолчанию квадрат), а фото лежит внутри абсолютно
// и вписывается с отступом — поэтому любое фото (вертикальное, широкое, большое) не может
// растянуть карточку, и все карточки в сетке получаются одной высоты.
export function ProductImage({
  src,
  alt = "",
  category = "case",
  className = "aspect-square",
  pad = "p-5",
  iconClass = "h-1/3 w-1/3",
  zoom = false,
  eager = false,
  imgClass = "",
  sizes = "(min-width: 1024px) 240px, 46vw",
}: {
  src: string | null | undefined;
  alt?: string;
  category?: string;
  className?: string;
  pad?: string;
  iconClass?: string;
  zoom?: boolean;
  eager?: boolean;
  imgClass?: string;
  // какую ширину фото занимает на экране — по ней браузер выбирает миниатюру 200/400 или оригинал 800
  sizes?: string;
}) {
  // фото из /uploads отдаются и уменьшенными копиями (?w=200 / ?w=400, см. app/uploads/[...path]/route.ts)
  // в srcSet только выровненные копии (товар по центру, одинаковые поля), оригинал 800px не нужен
  // &v=2 — новая версия копий (выровненные); старые браузер мог закэшировать на год
  const thumbs = src?.startsWith("/uploads/") ? `${src}?w=200&v=2 200w, ${src}?w=400&v=2 400w` : undefined;
  return (
    <div className={`${/\babsolute\b/.test(className) ? "" : "relative"} isolate shrink-0 overflow-hidden ${src ? "bg-studio" : "bg-surface-2"} ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbs ? `${src}?w=400&v=2` : src}
          srcSet={thumbs}
          sizes={thumbs ? sizes : undefined}
          alt={alt}
          loading={eager ? undefined : "lazy"}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-contain mix-blend-multiply ${thumbs ? "p-1" : pad} ${zoom ? "transition-transform duration-300 group-hover:scale-105" : ""} ${imgClass}`}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          <PartIcon category={category} className={`${iconClass} ${zoom ? "transition-transform duration-300 group-hover:scale-110" : ""}`} />
        </span>
      )}
    </div>
  );
}
