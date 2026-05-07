/**
 * Dev-only background tick for the campaign state machine.
 *
 * In production the campaign tick is invoked by an external scheduler
 * (Vercel Cron / k8s CronJob / crontab) hitting POST /api/cron/campaign-tick.
 * Locally there is no scheduler, so this module — imported lazily from
 * `instrumentation.ts` only when `NEXT_RUNTIME === 'nodejs'` — runs the tick
 * directly on the dev server so VKSU campaign transitions and child-entity
 * spawning "just work" while developing.
 *
 * Exists as a separate file (not inline in instrumentation.ts) because Next's
 * edge-runtime bundler walks instrumentation.ts even when guarded by
 * `NEXT_RUNTIME === 'nodejs'`, and Prisma + node:crypto aren't edge-safe.
 */

import { transitionCampaignsByDate } from '@/lib/campaigns';

declare global {
  var __campaignTickInterval: NodeJS.Timeout | undefined;
  var __campaignTickRunning: boolean | undefined;
}

if (process.env.NODE_ENV !== 'production' && !globalThis.__campaignTickInterval) {
  const periodMs = 30_000;

  const tick = async () => {
    if (globalThis.__campaignTickRunning) return;
    globalThis.__campaignTickRunning = true;
    try {
      const updated = await transitionCampaignsByDate();
      if (updated > 0) {
        console.log(`[dev/campaign-tick] Transitioned ${updated} campaign(s)`);
      }
    } catch (err) {
      console.error('[dev/campaign-tick] Failed:', err);
    } finally {
      globalThis.__campaignTickRunning = false;
    }
  };

  globalThis.__campaignTickInterval = setInterval(tick, periodMs);
  // Fire once shortly after boot so a freshly-created campaign doesn't have to
  // wait the full period to see its first transition land.
  setTimeout(tick, 2_000);
  console.log(`[dev/campaign-tick] Started (every ${periodMs / 1000}s, dev only)`);
}
