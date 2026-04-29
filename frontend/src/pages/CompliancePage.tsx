import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Calendar, RefreshCw, Check, AlertTriangle, Clock, FileText } from 'lucide-react';
import { complianceApi, clientApi } from '@/services/api';
import toast from 'react-hot-toast';

const TYPE_LABELS: Record<string, string> = {
  MOMS_Q: 'Moms (kvartal)',
  MOMS_M: 'Moms (månads)',
  ARBETSGIVAR: 'Arbetsgivardeklaration',
  INKOMST: 'Inkomstdeklaration',
  ARSREDOVISNING: 'Årsredovisning',
  CUSTOM: 'Övrigt',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  UPCOMING: { label: 'Upcoming', color: 'badge-blue', icon: Clock },
  DUE_SOON: { label: 'Due Soon', color: 'badge-yellow', icon: AlertTriangle },
  OVERDUE: { label: 'Overdue', color: 'badge-red', icon: AlertTriangle },
  COMPLETED: { label: 'Completed', color: 'badge-green', icon: Check },
};

export function CompliancePage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [selectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'deadlines' | 'ixbrl'>('deadlines');

  const { data, isLoading } = useQuery(
    ['compliance', filterStatus, filterClient],
    () => complianceApi.list({ status: filterStatus || undefined, clientId: filterClient || undefined }).then(r => r.data)
  );

  const { data: clientsData } = useQuery('clients-list', () => clientApi.list({ limit: 100 }).then(r => r.data));

  const generateMutation = useMutation(
    (clientId: string) => complianceApi.generate(clientId, selectedYear),
    {
      onSuccess: (_, clientId) => {
        queryClient.invalidateQueries('compliance');
        const name = clientsData?.clients?.find((c: any) => c.id === clientId)?.name || 'client';
        toast.success(`Generated deadlines for ${name}`);
      },
      onError: () => { toast.error('Failed to generate deadlines'); },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }: any) => complianceApi.update(id, data),
    {
      onSuccess: () => { queryClient.invalidateQueries('compliance'); toast.success('Updated'); },
    }
  );

  const deadlines = data?.deadlines || [];

  const upcoming = deadlines.filter((d: any) => d.status !== 'COMPLETED').length;
  const overdue = deadlines.filter((d: any) => d.status === 'OVERDUE').length;
  const dueSoon = deadlines.filter((d: any) => d.status === 'DUE_SOON').length;

  // iXBRL: årsredovisning deadlines across all clients
  const { data: ixbrlData, isLoading: ixbrlLoading } = useQuery(
    ['compliance-ixbrl', filterClient],
    () => complianceApi.list({ type: 'ARSREDOVISNING', clientId: filterClient || undefined }).then(r => r.data),
    { enabled: activeTab === 'ixbrl' }
  );
  const ixbrlDeadlines = ixbrlData?.deadlines || [];
  const ixbrlFiled = ixbrlDeadlines.filter((d: any) => d.status === 'COMPLETED').length;
  const ixbrlPending = ixbrlDeadlines.filter((d: any) => d.status !== 'COMPLETED').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Compliance Calendar</h3>
          <p className="text-sm text-gray-500 mt-0.5">Swedish tax & reporting deadlines per client</p>
        </div>
        <div className="flex items-center gap-2">
          {filterClient && activeTab === 'deadlines' && (
            <button
              onClick={() => generateMutation.mutate(filterClient)}
              disabled={generateMutation.isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-klary-600 bg-klary-50 hover:bg-klary-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generateMutation.isLoading ? 'animate-spin' : ''}`} />
              Generate {selectedYear} Deadlines
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('deadlines')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'deadlines' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Calendar className="w-4 h-4" /> Deadlines
        </button>
        <button
          onClick={() => setActiveTab('ixbrl')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'ixbrl' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileText className="w-4 h-4" /> iXBRL Filings
        </button>
      </div>

      {activeTab === 'deadlines' && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <div><p className="stat-value">{overdue}</p><p className="stat-label">Overdue</p></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div>
                <div><p className="stat-value">{dueSoon}</p><p className="stat-label">Due Within 14 Days</p></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div>
                <div><p className="stat-value">{upcoming}</p><p className="stat-label">Open Deadlines</p></div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              className="input w-auto text-sm py-1.5"
            >
              <option value="">All Clients</option>
              {clientsData?.clients?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              {['', 'OVERDUE', 'DUE_SOON', 'UPCOMING', 'COMPLETED'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${filterStatus === s ? 'bg-klary-100 text-klary-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {s === '' ? 'All' : STATUS_CONFIG[s]?.label || s}
                </button>
              ))}
            </div>
          </div>

          {/* Deadlines Table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : deadlines.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-2" />
                <p className="font-medium text-gray-600">No compliance deadlines yet.</p>
                <p className="text-sm mt-1">Select a client above and click "Generate Deadlines" to auto-create Swedish tax deadlines.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Client</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Due Date</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Notes</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deadlines.map((d: any) => {
                    const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.UPCOMING;
                    const dueDate = new Date(d.dueDate);
                    const isOverdue = d.status === 'OVERDUE';
                    const isDueSoon = d.status === 'DUE_SOON';

                    return (
                      <tr key={d.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/30' : isDueSoon ? 'bg-yellow-50/30' : ''}`}>
                        <td className="table-cell font-medium text-gray-900">{d.client?.name}</td>
                        <td className="table-cell text-gray-700">{TYPE_LABELS[d.type] || d.type}</td>
                        <td className={`table-cell font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-700'}`}>
                          {dueDate.toLocaleDateString('sv-SE')}
                        </td>
                        <td className="table-cell">
                          <span className={sc.color}>{sc.label}</span>
                        </td>
                        <td className="table-cell text-gray-500 text-sm">{d.notes || '—'}</td>
                        <td className="table-cell">
                          {d.status !== 'COMPLETED' && (
                            <button
                              onClick={() => updateMutation.mutate({ id: d.id, data: { status: 'COMPLETED' } })}
                              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded"
                            >
                              <Check className="w-3 h-3" /> Done
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === 'ixbrl' && (
        <>
          {/* iXBRL Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg"><Check className="w-5 h-5 text-emerald-600" /></div>
                <div><p className="stat-value">{ixbrlFiled}</p><p className="stat-label">Filed</p></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg"><Clock className="w-5 h-5 text-orange-600" /></div>
                <div><p className="stat-value">{ixbrlPending}</p><p className="stat-label">Pending Filing</p></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><FileText className="w-5 h-5 text-blue-600" /></div>
                <div><p className="stat-value">{ixbrlDeadlines.length}</p><p className="stat-label">Total</p></div>
              </div>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">Digital Årsredovisning 2026 (iXBRL)</p>
            <p>From 2026, all limited companies in Sweden must file annual reports digitally in iXBRL format to Bolagsverket. Track filing status per client below. Mark as "Filed" once submitted via SIE-compatible software.</p>
          </div>

          {/* Client filter */}
          <div>
            <select
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              className="input w-auto text-sm py-1.5"
            >
              <option value="">All Clients</option>
              {clientsData?.clients?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* iXBRL Table */}
          <div className="card overflow-hidden">
            {ixbrlLoading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : ixbrlDeadlines.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2" />
                <p className="font-medium text-gray-600">No årsredovisning deadlines found.</p>
                <p className="text-sm mt-1">Go to the Deadlines tab, select a client, and generate deadlines to get started.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Client</th>
                    <th className="table-header">Filing Deadline</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Notes</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ixbrlDeadlines.map((d: any) => {
                    const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.UPCOMING;
                    const dueDate = new Date(d.dueDate);
                    const isOverdue = d.status === 'OVERDUE';
                    return (
                      <tr key={d.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                        <td className="table-cell font-medium text-gray-900">{d.client?.name}</td>
                        <td className={`table-cell font-medium ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                          {dueDate.toLocaleDateString('sv-SE')}
                        </td>
                        <td className="table-cell"><span className={sc.color}>{sc.label}</span></td>
                        <td className="table-cell text-gray-500 text-sm">{d.notes || '—'}</td>
                        <td className="table-cell">
                          {d.status !== 'COMPLETED' ? (
                            <button
                              onClick={() => updateMutation.mutate({ id: d.id, data: { status: 'COMPLETED', notes: 'iXBRL filed to Bolagsverket' } })}
                              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded"
                            >
                              <Check className="w-3 h-3" /> Mark Filed
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <Check className="w-3 h-3" /> Filed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
