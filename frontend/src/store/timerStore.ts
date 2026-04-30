import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimerStore {
  running: boolean;
  startedAt: number | null;
  clientId: string | null;
  clientName: string | null;
  category: string;
  start: (clientId: string | null, clientName: string | null, category?: string) => void;
  stop: () => { durationSeconds: number; clientId: string | null; clientName: string | null; category: string } | null;
  reset: () => void;
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      running: false,
      startedAt: null,
      clientId: null,
      clientName: null,
      category: 'bookkeeping',

      start: (clientId, clientName, category = 'bookkeeping') => {
        set({ running: true, startedAt: Date.now(), clientId, clientName, category });
      },

      stop: () => {
        const { running, startedAt, clientId, clientName, category } = get();
        if (!running || !startedAt) return null;
        const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
        set({ running: false, startedAt: null, clientId: null, clientName: null });
        return { durationSeconds, clientId, clientName, category };
      },

      reset: () => {
        set({ running: false, startedAt: null, clientId: null, clientName: null, category: 'bookkeeping' });
      },
    }),
    { name: 'klary-timer' }
  )
);
