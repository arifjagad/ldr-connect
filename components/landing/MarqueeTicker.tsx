const items = [
  "Truth or Dare",
  "Snake & Ladder",
  "Couple Quiz",
  "Real-time Session",
  "AI Questions",
  "Coin System",
  "Couple Linking",
  "Anniversary Reminder",
];

function Dot() {
  return <span className="mx-5 text-[#FF3D7F] opacity-50">✦</span>;
}

export function MarqueeTicker() {
  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-[#FF3D7F20] bg-[#FF3D7F08] py-3.5">
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-linear-to-r from-[#0A0A0B] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-linear-to-l from-[#0A0A0B] to-transparent" />

      <div className="animate-marquee flex w-max items-center">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center whitespace-nowrap">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF6B9D]">
              {item}
            </span>
            <Dot />
          </span>
        ))}
      </div>
    </div>
  );
}
