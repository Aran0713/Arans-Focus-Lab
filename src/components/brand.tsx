import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/focus-lab-logo.svg"
        alt="Aran’s Lab logo"
        width={48}
        height={45}
        priority
        className="h-10 w-auto object-contain"
      />
      <div className={compact ? "hidden sm:block" : ""}>
        <div className="text-[15px] font-extrabold tracking-[-.02em]">Aran’s Focus Lab</div>
        <div className="text-[10px] uppercase tracking-[.19em] text-[var(--steel)]">by Aran’s Lab</div>
      </div>
    </div>
  );
}
