// Цена крупным шрифтом заголовков, а валюта («so'm» / «сум») — мелко обычным шрифтом.
// Число в заголовочном шрифте никогда не переносится, а валюта в узкой
// карточке на телефоне может уйти на следующую строку — цена не вылезает за карточку.
export function MoneyText({ text }: { text: string }) {
  const m = text.match(/^(.*?)\s*(so'm|сум)$/);
  if (!m) return <>{text}</>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-[0.3em]">
      <span className="whitespace-nowrap">{m[1]}</span>
      <span className="font-sans text-[0.62em] font-semibold tracking-normal whitespace-nowrap opacity-70">{m[2]}</span>
    </span>
  );
}
