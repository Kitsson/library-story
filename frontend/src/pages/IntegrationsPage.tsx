import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plug, Check, Plus, Loader2, Upload } from 'lucide-react';
import { integrationApi, clientApi } from '@/services/api';
import toast from 'react-hot-toast';

export function IntegrationsPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: 'FORTNOX', name: '', accessToken: '' });
  const [sie4ClientId, setSie4ClientId] = useState('');
  const [sie4Uploading, setSie4Uploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: integrations } = useQuery('integrations', () => integrationApi.list().then(r => r.data));
  const { data: providers } = useQuery('integration-providers', () => integrationApi.providers().then(r => r.data));

  const connectMutation = useMutation((data: any) => integrationApi.connect(data), {
    onSuccess: () => { queryClient.invalidateQueries('integrations'); setShowForm(false); toast.success('Integration connected!'); },
    onError: (err: any) => { toast.error(err.response?.data?.error || 'Connection failed'); },
  });

  const { data: clientsData } = useQuery('clients-for-sie4', () => clientApi.list().then(r => r.data));

  const handleSIE4Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sie4ClientId) { toast.error('Select a client first.'); return; }
    setSie4Uploading(true);
    try {
      const res = await integrationApi.importSIE4(file, sie4ClientId);
      toast.success(`${res.data.message} — ${res.data.imported} transactions imported`);
      queryClient.invalidateQueries('integrations');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'SIE4 import failed');
    } finally {
      setSie4Uploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const providerIcons: Record<string, string> = {
    FORTNOX: 'Fortnox', VISMA_EEKONOMI: 'Visma', BJORN_LUNDEN: 'BL', ECONOMIC: 'e-c', TRIPLETEX: 'TX',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div><h3 className="text-lg font-semibold text-gray-900">Integrations</h3><p className="text-sm text-gray-500">Connect your accounting software and services</p></div>

      {/* Connected */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations?.integrations?.map((int: any) => (
          <div key={int.id} className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-klary-100 flex items-center justify-center text-klary-700 font-bold text-sm">
              {providerIcons[int.provider] || int.provider[0]}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{int.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge-green text-xs">{int.status}</span>
                {int.lastSyncAt && <span className="text-xs text-gray-400">Synced {new Date(int.lastSyncAt).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SIE4 File Import */}
      <div className="card p-6">
        <h4 className="font-semibold text-gray-900 mb-4">SIE4 File Import</h4>
        <p className="text-sm text-gray-500 mb-4">Import transactions from any Swedish accounting software by uploading a SIE4 export file (.se / .si / .sie).</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
            <select className="input" value={sie4ClientId} onChange={e => setSie4ClientId(e.target.value)}>
              <option value="">Select client…</option>
              {clientsData?.clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">SIE4 File</label>
            <input ref={fileInputRef} type="file" accept=".se,.si,.sie" className="hidden" onChange={handleSIE4Upload} />
            <button
              className="btn-primary text-sm"
              disabled={!sie4ClientId || sie4Uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {sie4Uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {sie4Uploading ? 'Importing…' : 'Upload & Import'}
            </button>
          </div>
        </div>
      </div>

      {/* Available */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900">Available Integrations</h4>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4 mr-1" /> Connect</button>
        </div>

        {showForm && (
          <form onSubmit={e => { e.preventDefault(); connectMutation.mutate(form); }} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <select className="input" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
              {providers?.providers?.filter((p: any) => p.status === 'available').map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input className="input" placeholder="Connection name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <input className="input" placeholder="API Token" value={form.accessToken} onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))} required />
            <div className="sm:col-span-3 flex gap-3">
              <button type="submit" className="btn-primary" disabled={connectMutation.isLoading}>
                {connectMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plug className="w-4 h-4 mr-2" />}
                Connect
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {providers?.providers?.map((p: any) => {
            const isConnected = integrations?.integrations?.some((i: any) => i.provider === p.id);
            return (
              <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${isConnected ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.description} • {p.countries.join(', ')}</p>
                  </div>
                </div>
                {isConnected ? (
                  <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium"><Check className="w-4 h-4" /> Connected</span>
                ) : (
                  <span className={`text-xs px-2 py-1 rounded ${p.status === 'coming_soon' ? 'bg-gray-100 text-gray-500' : 'bg-klary-100 text-klary-700'}`}>
                    {p.status === 'coming_soon' ? 'Coming Soon' : 'Available'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}