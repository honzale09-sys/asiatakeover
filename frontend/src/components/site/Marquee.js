export default function Marquee({ items }) {
  const seq = [...items, ...items, ...items];
  return (
    <div
      className="relative overflow-hidden border-y border-white/10 bg-[#0B0C12] py-3"
      data-testid="marquee-ribbon"
    >
      <div className="animate-marquee flex w-max whitespace-nowrap">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center">
            {seq.map((it, i) => (
              <span
                key={i}
                className="font-mono2 text-xs sm:text-sm uppercase tracking-[0.25em] text-slate-300 flex items-center"
              >
                <span className="px-5">{it}</span>
                <span className="text-[#FF0055]">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
