export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><span className="brand-mark" aria-hidden="true"/><div className={compact ? "hidden sm:block" : ""}><div className="text-[15px] font-extrabold tracking-[-.02em]">Aran’s Focus Lab</div><div className="text-[10px] uppercase tracking-[.19em] text-[var(--steel)]">by Aran’s Lab</div></div></div>;
}
