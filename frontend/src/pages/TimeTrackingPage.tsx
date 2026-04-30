import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, Zap, Trash2 } from 'lucide-react';
import { timeApi, clientApi } from '@/services/api';
import toast from 'react-hot-toast';

export function TimeTrackingPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: '', category: 'bookkeeping', duration: 30, billable: true, clientId: '' });
  const queryClient = useQueryClient();

  const { data: entries } = useQuery('time-entries', () => timeApi.list().then(r => r.data));
  const { data: weekly } = useQuery('time-weekly', () => timeApi.weekly().then(r => r.data));
  const { data: clients } = useQuery('time-clients', () => clientApi.list().then(r => r.data));

  const createMutation = useMutation(timeApi.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('time-entries');
      queryClient.invalidateQueries('time-weekly');
      setShowForm(false);
      toast.success('Time logged!');
    },
    onError: (e: any) => { toast.error(e.response?.data?.error || 'Failed to log time'); },
  });

  const deleteMutation = useMutation(timeApi.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('time-entries');
      queryClient.invalidateQueries('time-weekly');
      toast.success('Entry deleted');
    },
    onError: (e: any) => { toast.error(e.response?.data?.error || 'Delete failed'); },
  });

  const cats = ['bookkeeping', 'advisory', 'compliance', 'admin', 'meeting', 'other'];
  const allEntries: any[] = entries?.entries || [];
  const autoTracked = allEntries.filter(e => e.type === 'AUTO_TRACKED');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Weekly Summary */}
      {weekly?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="stat-card"><p className="stat-label">Total This Week</p><p className="stat-value">{weekly.summary.totalHours.toFixed(1)}h</p></div>
          <div className="stat-card"><p className="stat-label">Billable</p><p className="stat-value text-emerald-600">{weekly.summary.billableHours.toFixed(1)}h</p></div>
          <div className="stat-card"><p className="stat-label">Admin</p><p className="stat-value text-gray-500">{weekly.summary.adminHours.toFixed(1)}h</p></div>
          <div className="stat-card"><p className="stat-label">Utilization</p><p className="stat-value text-klary-600">{weekly.summary.totalHours > 0 ? ((weekly.summary.billableHours / weekly.summary.totalHours) * 100).toFixed(0) : 0}%</p></div>
        </div>
      )}

      {/* Auto-tracked review banner */}
      {autoTracked.length > 0 && (
        <div className="bg-klary-50 border border-klary-200 rounded-xl p-4 flex items-start gap-3">
          <Zap className="w-5 h-5 text-klary-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-klary-800">
              {autoTracked.length} auto-tracked entr{autoTracked.length === 1 ? 'y' : 'ies'} detected
            </p>
            <p className="text-xs text-klary-600 mt-0.5">
              KLARY tracked your page activity automatically. Review below — delete any that aren't billable.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Time Entries</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Log Time
        </button>
      </div>

      {/* Manual log form */}
      {showForm && (
        <div className="card p-6">
          <form
            onSubmit={e => {
              e.preventDefault();
              createMutation.mutate({
                ...form,
                duration: form.duration * 60,
                startedAt: new Date(Date.now() - form.duration * 60000).toISOString(),
                endedAt: new Date().toISOString(),
                type: 'MANUAL',
                source: 'manual',
              });
            }}
            className="grid grid-cols-1 sm:grid-cols-4 gap-4"
          >
            <input className="input sm:col-span-2" placeholder="What did you work on?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {cats.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <input type="number" className="input" placeholder="Minutes" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))} min={1} />
            <select className="input" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
              <option value="">No client</option>
              {clients?.clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.billable} onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))} />
              Billable
            </label>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={createMutation.isLoading}>Log</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Entries table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-header">Date</th>
              <th className="table-header">Description</th>
              <th className="table-header">Category</th>
              <th className="table-header">Duration</th>
              <th className="table-header">Client</th>
              <th className="table-header">Source</th>
              <th className="table-header w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allEntries.length === 0 && (
              <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-8">
                No time entries yet. Use the timer in the sidebar or log time manually.
              </td></tr>
            )}
            {allEntries.map((e: any) => (
              <tr key={e.id} className={`hover:bg-gray-50 ${e.type === 'AUTO_TRACKED' ? 'bg-klary-50/40' : ''}`}>
                <td className="table-cell text-gray-500 whitespace-nowrap">{new Date(e.startedAt).toLocaleDateString('sv-SE')}</td>
                <td className="table-cell">{e.description || '—'}</td>
                <td className="table-cell"><span className="badge-blue capitalize">{e.category}</span></td>
                <td className="table-cell whitespace-nowrap">
                  {e.duration >= 3600
                    ? `${Math.floor(e.duration / 3600)}h ${Math.floor((e.duration % 3600) / 60)}m`
                    : `${Math.round(e.duration / 60)} min`}
                </td>
                <td className="table-cell text-gray-500">{e.client?.name || '—'}</td>
                <td className="table-cell">
                  {e.type === 'AUTO_TRACKED' ? (
                    <span className="flex items-center gap-1 text-xs text-klary-600 font-medium">
                      <Zap className="w-3 h-3" /> Auto
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      {e.source === 'timer' ? '⏱ Timer' : 'Manual'}
                    </span>
                  )}
                </td>
                <td className="table-cell">
                  <button
                    onClick={() => { if (confirm('Delete this entry?')) deleteMutation.mutate(e.id); }}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
