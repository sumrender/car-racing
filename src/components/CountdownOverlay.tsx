interface CountdownOverlayProps {
  count: number;
}

export default function CountdownOverlay({ count }: CountdownOverlayProps) {
  return (
    <div
      id="race-countdown-overlay"
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm pointer-events-none animate-in fade-in duration-300"
    >
      <div className="flex flex-col items-center">
        <div
          key={count}
          className="text-8xl md:text-9xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-amber-400 to-pink-500 animate-pulse drop-shadow-[0_10px_20px_rgba(234,179,8,0.4)]"
        >
          {count > 0 ? count : "GO!"}
        </div>
        <div className="text-sm font-mono tracking-widest uppercase text-white/80 mt-4 px-4 py-1.5 rounded-full bg-white/10 border border-white/20">
          Get Ready to Drift
        </div>
      </div>
    </div>
  );
}
