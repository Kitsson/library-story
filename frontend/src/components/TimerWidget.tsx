import { useState, useEffect } from 'react';
import { Play, Square, Timer, ChevronDown, ChevronUp } from 'lucide-react';
import { useTimerStore } from '@/store/timerStore';
import { timeApi, clientApi } from '@/services/api';
import { useQuery } from 'react-query';
import toast from 'react-hot-toast';

const CATEGORIES = ['bookkeeping', 'advisory', 'compliance', 'admin', 'meeting', 'other'];

function formatElapsed(startedAt: number): string {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function TimerWidget() {
  const { running, startedAt, clientName, category, start, stop, reset } = useTimerStore();
  const [elapsed, setElapsed] = useState('00:00');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for starting a new timer
  const [selClientId, setSelClientId] = useState('');
  const [selCategory, setSelCategory] = useState('bookkeeping');
  // Post-stop state
  const [pendingEntry, setPendingEntry] = useState<{ durationSeconds: number; clientId: string | null; clientName: string | null; category: string } | null>(null);
  const [postDesc, setPostDesc] = useState('');

  const { data: clientsData } = useQuery('timer-clients', () => clientApi.list().then(r => r.data), { staleTime: 60_000 });
  const clients: any[] = clientsData?.clients || [];

  // Tick every second when running
  useEffect(() => {
    if (!running || !startedAt) return;
    const interval = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000);
    setElapsed(formatElapsed(startedAt));
    return () => clearInterval(interval);
  }, [running, startedAt]);

  function handleStart() {
    const client = clients.find(c => c.id === selClientId);
    start(selClientId || null, client?.name || null, selCategory);
    setExpanded(false);
  }

  function handleStop() {
    const result = stop();
    if (result) {
      setPendingEntry(result);
      setPostDesc('');
      setExpanded(true);
    }
  }

  async function handleSave() {
    if (!pendingEntry) return;
    setSaving(true);
    try {
      await timeApi.create({
        description: postDesc || `${pendingEntry.category.charAt(0).toUpperCase() + pendingEntry.category.slice(1)} — timer`,
        category: pendingEntry.category,
        duration: pendingEntry.durationSeconds,
        billable: true,
        clientId: pendingEntry.clientId || null,
        startedAt: new Date(Date.now() - pendingEntry.durationSeconds * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        type: 'MANUAL',
        source: 'timer',
      });
      toast.success(`Time saved — ${Math.round(pendingEntry.durationSeconds / 60)} min logged`);
      setPendingEntry(null);
      setExpanded(false);
    } catch {
      toast.error('Failed to save time entry');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setPendingEntry(null);
    reset();
    setExpanded(false);
  }

  // — Running state —
  if (running && startedAt) {
    return (
      <div className="mx-3 mb-3 rounded-xl bg-klary-600 text-white p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-medium text-klary-100">Recording</span>
          </div>
          <button onClick={handleStop} className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors">
            <Square className="w-3 h-3" /> Stop
          </button>
        </div>
        <p className="text-2xl font-mono font-bold tracking-wider">{elapsed}</p>
        {clientName && <p className="text-xs text-klary-200 truncate mt-0.5">{clientName}</p>}
        <p className="text-xs text-klary-300 capitalize">{category}</p>
      </div>
    );
  }

  // — Pending save after stop —
  if (pendingEntry) {
    return (
      <div className="mx-3 mb-3 rounded-xl border border-klary-200 bg-klary-50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-klary-700">Save {Math.round(pendingEntry.durationSeconds / 60)} min?</p>
          <button onClick={handleDiscard} className="text-xs text-gray-400 hover:text-red-500">Discard</button>
        </div>
        <input
          className="input text-sm py-1.5"
          placeholder="What did you work on?"
          value={postDesc}
          onChange={e => setPostDesc(e.target.value)}
          autoFocus
        />
        <button
          className="btn-primary w-full justify-center py-1.5 text-sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Entry'}
        </button>
      </div>
    );
  }

  // — Idle state —
  return (
    <div className="mx-3 mb-3">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:border-klary-300 hover:bg-klary-50 text-sm text-gray-600 transition-colors"
      >
        <Timer className="w-4 h-4 text-klary-500 shrink-0" />
        <span className="flex-1 text-left">Start Timer</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
          <select className="input text-sm py-1.5" value={selClientId} onChange={e => setSelClientId(e.target.value)}>
            <option value="">No client</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input text-sm py-1.5" value={selCategory} onChange={e => setSelCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <button onClick={handleStart} className="btn-primary w-full justify-center py-1.5 text-sm">
            <Play className="w-3.5 h-3.5 mr-1.5" /> Start
          </button>
        </div>
      )}
    </div>
  );
}
