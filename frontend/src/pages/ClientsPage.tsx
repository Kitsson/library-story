import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Search, Plus, Phone, Mail, Shield, X, ChevronDown } from 'lucide-react';
import { clientApi, kycApi } from '@/services/api';
import toast from 'react-hot-toast';

const KYC_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'Pending',     color: 'badge-yellow' },
  IN_PROGRESS: { label: 'In Progress', color: 'badge-blue' },
  APPROVED:    { label: 'Approved',    color: 'badge-green' },
  REJECTED:    { label: 'Rejected',    color: 'badge-red' },
  EXPIRED:     { label: 'Expired',     color: 'badge-red' },
};

const RISK_CONFIG: Record<string, { label: string; color: string }> = {
  LOW:      { label: 'Low',      color: 'text-emerald-700 bg-emerald-50' },
  MEDIUM:   { label: 'Medium',   color: 'text-yellow-700 bg-yellow-50' },
  HIGH:     { label: 'High',     color: 'text-orange-700 bg-orange-50' },
  CRITICAL: { label: 'Critical', color: 'text-red-700 bg-red-50' },
};

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', orgNumber: '', email: '', phone: '', contactName: '', industry: '', size: 'SMALL' });
  const [kycModal, setKycModal] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(['clients', search], () => clientApi.list({ search }).then(r => r.data));

  const { data: kycData, isLoading: kycLoading } = useQuery(
    ['kyc', kycModal],
    () => kycApi.get(kycModal!).then(r => r.data),
    { enabled: !!kycModal }
  );

  const [kycChecklist, setKycChecklist] = useState<any[]>([]);
  const [kycStatus, setKycStatus] = useState('PENDING');
  const [kycRiskLevel, setKycRiskLevel] = useState('');
  const [kycNotes, setKycNotes] = useState('');
  const [kycLoaded, setKycLoaded] = useState<string | null>(null);

  if (kycData && kycModal && kycLoaded !== kycModal) {
    setKycChecklist(kycData.kycChecklist || []);
    setKycStatus(kycData.kycStatus || 'PENDING');
    setKycRiskLevel(kycData.kycRiskLevel || '');
    setKycNotes(kycData.kycNotes || '');
    setKycLoaded(kycModal);
  }

  const createMutation = useMutation((data: any) => clientApi.create(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('clients');
      setShowForm(false);
      setForm({ name: '', orgNumber: '', email: '', phone: '', contactName: '', industry: '', size: 'SMALL' });
      toast.success('Client created!');
    },
    onError: (err: any) => { toast.error(err.response?.data?.error || 'Failed to create client'); },
  });

  const kycMutation = useMutation(
    (payload: any) => kycApi.update(kycModal!, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['kyc', kycModal]);
        queryClient.invalidateQueries('clients');
        toast.success('KYC updated.');
      },
      onError: (e: any) => { toast.error(e.response?.data?.error || 'Failed to save KYC'); },
    }
  );

  function saveKyc() {
    kycMutation.mutate({ kycStatus, kycRiskLevel: kycRiskLevel || undefined, kycNotes: kycNotes || undefined, kycChecklist });
  }

  function toggleCheck(idx: number) {
    setKycChecklist(list => list.map((item, i) => i === idx ? { ...item, completed: !item.completed } : item));
  }

  const sizeLabel = (s: string) => ({ MICRO: '1-5', SMALL: '6-20', MEDIUM: '21-100', LARGE: '100+' }[s] || s);
  const statusColor = (s: string) => ({ ACTIVE: 'badge-green', INACTIVE: 'badge-yellow', AT_RISK: 'badge-red', CHURNED: 'badge-red' }[s] || 'badge-blue');

  const completedCount = kycChecklist.filter(i => i.completed).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search clients..." className="input pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </button>
      </div>

      {/* Add Client Form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Add New Client</h3>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input className="input" placeholder="Client name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <input className="input" placeholder="Org. Number" value={form.orgNumber} onChange={e => setForm(f => ({ ...f, orgNumber: e.target.value }))} />
            <input type="email" className="input" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className="input" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <input className="input" placeholder="Contact person" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
            <select className="input" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}>
              <option value="MICRO">Micro (1-5 employees)</option>
              <option value="SMALL">Small (6-20)</option>
              <option value="MEDIUM">Medium (21-100)</option>
              <option value="LARGE">Large (100+)</option>
            </select>
            <div className="sm:col-span-3 flex gap-3">
              <button type="submit" className="btn-primary" disabled={createMutation.isLoading}>Create Client</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Client Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading clients...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Industry</th>
                <th className="table-header">Size</th>
                <th className="table-header">Status</th>
                <th className="table-header">KYC</th>
                <th className="table-header">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.clients?.length === 0 && (
                <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-8">No clients found. Add your first client!</td></tr>
              )}
              {data?.clients?.map((client: any) => {
                const kycCfg = KYC_STATUS_CONFIG[client.kycStatus || 'PENDING'];
                return (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-klary-100 flex items-center justify-center text-klary-700 font-semibold text-sm">
                          {client.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{client.name}</p>
                          {client.orgNumber && <p className="text-xs text-gray-400">{client.orgNumber}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500">{client.industry || '—'}</td>
                    <td className="table-cell"><span className="badge-blue">{sizeLabel(client.size)}</span></td>
                    <td className="table-cell"><span className={statusColor(client.status)}>{client.status}</span></td>
                    <td className="table-cell">
                      <button
                        onClick={() => { setKycModal(client.id); setKycLoaded(null); }}
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${kycCfg.color} hover:opacity-80 transition-opacity`}
                      >
                        <Shield className="w-3 h-3" />
                        {kycCfg.label}
                      </button>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3 text-gray-400">
                        {client.email && <Mail className="w-4 h-4 hover:text-gray-600 cursor-pointer" />}
                        {client.phone && <Phone className="w-4 h-4 hover:text-gray-600 cursor-pointer" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* KYC Modal */}
      {kycModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-klary-100 rounded-lg"><Shield className="w-5 h-5 text-klary-700" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">KYC / AML Due Diligence</h3>
                  <p className="text-sm text-gray-500">{kycData?.name || '...'}</p>
                </div>
              </div>
              <button onClick={() => setKycModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {kycLoading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Status + Risk */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">KYC Status</label>
                    <div className="relative">
                      <select
                        value={kycStatus}
                        onChange={e => setKycStatus(e.target.value)}
                        className="input appearance-none pr-8"
                      >
                        {Object.entries(KYC_STATUS_CONFIG).map(([v, c]) => (
                          <option key={v} value={v}>{c.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Risk Level</label>
                    <div className="relative">
                      <select
                        value={kycRiskLevel}
                        onChange={e => setKycRiskLevel(e.target.value)}
                        className="input appearance-none pr-8"
                      >
                        <option value="">Not assessed</option>
                        {Object.entries(RISK_CONFIG).map(([v, c]) => (
                          <option key={v} value={v}>{c.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="label mb-0">Due Diligence Checklist</label>
                    <span className="text-xs text-gray-400">{completedCount} / {kycChecklist.length} completed</span>
                  </div>
                  <div className="space-y-2">
                    {kycChecklist.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${item.completed ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-100 hover:border-gray-200'}`}
                        onClick={() => toggleCheck(idx)}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-emerald-500' : 'border-2 border-gray-300'}`}>
                          {item.completed && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${item.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{item.item}</p>
                          {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                        </div>
                        {item.required && <span className="text-xs text-red-500 font-medium flex-shrink-0">Required</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={kycNotes}
                    onChange={e => setKycNotes(e.target.value)}
                    rows={3}
                    className="input resize-none"
                    placeholder="Risk assessment notes, sources verified, etc."
                  />
                </div>

                {/* Verified info */}
                {kycData?.kycVerifiedAt && (
                  <p className="text-xs text-gray-400">
                    Approved on {new Date(kycData.kycVerifiedAt).toLocaleDateString('sv-SE')}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <button onClick={saveKyc} disabled={kycMutation.isLoading} className="btn-primary">
                    {kycMutation.isLoading ? 'Saving…' : 'Save KYC'}
                  </button>
                  <button onClick={() => setKycModal(null)} className="btn-secondary">Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
