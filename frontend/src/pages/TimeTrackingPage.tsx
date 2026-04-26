import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus } from 'lucide-react';
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
    onSuccess: () => { queryClient.invalidateQueries('time-entries'); queryClient.invalidateQueries('time-weekly'); setShowForm(false); toast.success('Time logged!'); },
  });

  const cats = ['bookkeeping', 'advisory', 'compliance', 'admin', 'meeting', 'other'];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Weekly Summary */}
      {weekly?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="stat-card"><p className="stat-label">Total This Week</p><p className="stat-value">{weekly.summary.totalHours.toFixed(1)}h</p></div>
          <div className="stat-card"><p className="stat-label">Billable</p><p className="stat-value text-emerald-600">{weekly.summary.billableHours.toFixed(1)}h</p></div>
          <div className="stat-card"><p className="stat-label">Admin</p><p className="stat-value text-gray-500">{weekly.summary.adminHours.toFixed(1)}h</p></div>
          <div className="stat-card"><p className="stat-label">Utilization</p><p className="stat-value text-klary-600">{weekly.summary.totalHours > 0 ? ((weekly.summary.billableHours / weekly.summary.totalHours) * 100).toFixed(0) : 0}%</p></div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Time Entries</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus className="w-4 h-4 mr-2" /> Log Time</button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-6">
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate({ ...form, duration: form.duration * 60, startedAt: new Date(Date.now() - form.duration * 60000).toISOString(), endedAt: new Date().toISOString() }); }} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <input className="input sm:col-span-2" placeholder="What did you work on?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
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

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="table-header">Time</th><th className="table-header">Description</th><th className="table-header">Category</th><th className="table-header">Duration</th><th className="table-header">Client</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {entries?.entries?.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="table-cell text-gray-500">{new Date(e.startedAt).toLocaleDateString()}</td>
                <td className="table-cell">{e.description || '—'}</td>
                <td className="table-cell"><span className="badge-blue">{e.category}</span></td>
                <td className="table-cell">{(e.duration / 60).toFixed(0)} min</td>
                <td className="table-cell text-gray-500">{e.client?.name || '—'}</td>
              </tr>
            )) || <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">No time entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}