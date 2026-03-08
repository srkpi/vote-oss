import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[var(--kpi-navy)] text-white mt-auto">
      <div className="container py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <span className="font-display text-base font-semibold leading-tight block text-white">
                КПІ Голос
              </span>
              <span className="text-[10px] font-body text-white/50 uppercase tracking-widest leading-none">
                КПІ ім. Ігоря Сікорського
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm font-body text-white/60">
            <Link href="/elections" className="hover:text-white transition-colors">
              Вибори
            </Link>
            <a
              href="https://kpi.ua"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              kpi.ua
            </a>
          </div>

          <p className="text-xs font-body text-white/40">
            © {new Date().getFullYear()} КПІ ім. Ігоря Сікорського
          </p>
        </div>
      </div>
    </footer>
  );
}
