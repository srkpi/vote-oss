import { cn } from '@/lib/utils/common';

export interface SceneFallbackProps {
  className?: string;
  /** Matches `VoteScene`'s variant so the poster frame never mismatches the real scene. */
  variant?: 'hero' | 'aside' | 'ambient';
}

/**
 * Pure CSS/SVG stand-in for `VoteScene`. Renders instantly (no JS, no
 * WebGL) so it doubles as:
 *  - the poster frame shown for the brief moment before the real scene
 *    mounts on the client (avoiding a flash of empty background),
 *  - the permanent view for browsers without WebGL, for
 *    `prefers-reduced-motion`, or if the scene throws at runtime.
 *
 * Deliberately built only from `animate-*` utilities already defined in
 * `globals.css` (each wrapped in `motion-safe:` so reduced-motion users get
 * a still frame) — no new keyframes, no risk of diverging from the rest of
 * the app's motion language.
 */
export function SceneFallback({ className, variant = 'hero' }: SceneFallbackProps) {
  // Kept in sync with `vote-scene-canvas.tsx`'s `logoVisibility` config: the
  // fallback and the real scene must agree on when/where the mark shows, or
  // it visibly pops into a different position the moment the real scene
  // takes over.
  const showMark = variant === 'hero';

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="navy-gradient-subtle absolute inset-0" />

      <div
        className="motion-safe:animate-glow-breathe absolute -top-32 -right-32 h-112 w-md rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0,138,207,0.28) 0%, transparent 70%)',
        }}
      />
      <div
        className="motion-safe:animate-glow-breathe-orange absolute -bottom-24 -left-24 h-80 w-80 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(240,125,0,0.14) 0%, transparent 70%)',
          animationDelay: '2s',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(16,98,163,0.35) 0%, transparent 65%)',
        }}
      />

      {showMark && (
        // `hidden lg:block` matches the real scene's own desktop-only check
        // (`DESKTOP_BREAKPOINT_PX = 1024`, the same value as Tailwind's `lg`)
        // — same breakpoint, same rough on-screen position (~65% across),
        // so there's no pop/jump when the real scene takes over.
        <div className="absolute inset-0 hidden lg:block">
          <div
            className="motion-safe:animate-float-gentle absolute top-1/2 left-[65%] -translate-x-1/2 -translate-y-1/2"
            style={{ animationDuration: '7s' }}
          >
            <div
              className="absolute inset-0 -m-10 rounded-full blur-2xl"
              style={{
                background: 'radial-gradient(circle, rgba(0,138,207,0.45) 0%, transparent 70%)',
              }}
            />
            <svg
              viewBox="0 0 24 24"
              className="relative h-32 w-32 opacity-90 drop-shadow-[0_0_30px_rgba(0,138,207,0.5)] sm:h-40 sm:w-40"
              fill="none"
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.801 10A10 10 0 1 1 17 3.335" />
              <path d="m9 11 3 3L22 4" />
            </svg>
          </div>
        </div>
      )}

      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
}
