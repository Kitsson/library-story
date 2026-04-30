import { useEffect, useRef } from 'react';
import { timeApi } from '@/services/api';

const MIN_SECONDS = 180; // 3 minutes minimum to create an entry
const IDLE_TIMEOUT = 120_000; // 2 min no activity = pause tracking

export function useActivityTracker(category: string, clientId?: string) {
  const activeTimeRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleRef = useRef(false);

  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      idleRef.current = false;
    };

    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('click', onActivity, { passive: true });

    // Tick every 10s — accumulate active time, pause when idle
    intervalRef.current = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs > IDLE_TIMEOUT) {
        idleRef.current = true;
      } else {
        activeTimeRef.current += 10;
      }
    }, 10_000);

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('click', onActivity);
      if (intervalRef.current) clearInterval(intervalRef.current);

      const seconds = activeTimeRef.current;
      if (seconds >= MIN_SECONDS) {
        timeApi.create({
          description: `${category.charAt(0).toUpperCase() + category.slice(1)} — auto-tracked`,
          category,
          duration: seconds,
          billable: true,
          clientId: clientId || null,
          startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
          endedAt: new Date().toISOString(),
          type: 'AUTO_TRACKED',
          source: 'activity',
        }).catch(() => {}); // silent — don't interrupt UX
      }
    };
  }, [category, clientId]);
}
