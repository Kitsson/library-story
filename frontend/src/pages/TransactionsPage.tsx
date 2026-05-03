import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Sparkles, Check, Download, Database, Info } from 'lucide-react';
import { transactionApi, dashboardApi } from '@/services/api';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import toast from 'react-hot-toast';

export function TransactionsPage() {
  useActivityTracker('bookkeeping');
  const [filter, setFilter] = useState('UNCATEGORIZED');
  const [tooltip, setTooltip] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(['transactions', filter], () => transactionApi.list({ status: filter }).then(r => r.data));
  const { data: summary } = useQuery('dashboard-summary', () => dashboardApi.summary().then(r => r.data));

  const categorizeMutation = useMutation((id: string) => transactionApi.categorize(id), {
    onSuccess: () => { queryClient.invalidateQueries('transactions'); queryClient.invalidateQueries('dashboard-summary'); toast.success('AI categorized!'); },
  });

  const confirmMutation = useMutation(({ id, data }: any) => transactionApi.confirm(id, data), {
    onSuccess: () => { queryClient.invalidateQueries('transactions'); toast.success('Confirmed!'); },
  });

  const seedMutation = useMutation(() => transactionApi.seedDemo(), {
    onSuccess: (res: any) => {
      queryClient.invalidateQueries('transactions');
      setFilter('UNCATEGORIZED');
      toast.success(res.data.message);
    },
    onError: () => { toast.error('Could not load demo data.'); },
  });

  const handleExportCsv = async () => {
    try {
      toast.success('Downloading CSV...');
      const res = await transactionApi.exportCsv({ status: filter || undefined });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'klary-transactions.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed.');
    }
  };

  const statusColors: Record<string, string> = {
    UNCATEGORIZED: 'badge-yellow',
    AI_SUGGESTED: 'badge-blue',
    CONFIRMED: 'badge-green',
    POSTED: 'badge-green',
    FLAGGED: 'badge-red',
  };

  const quota = summary?.quota?.ai;
  const quotaPct = quota?.total > 0 ? quota.used / quota.total : 0;
  const quotaAtLimit = quota && quota.used >= quota.total;
  const quotaNearLimit = quota && quotaPct >= 0.8 && !quotaAtLimit;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
          <p className="text-sm text-gray-500 mt-0.5">AI-powered categorization for your client transactions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
            <Database className="w-3.5 h-3.5" />
            {seedMutation.isLoading ? 'Loading...' : 'Load Demo Data'}
          </button>
          <button onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <div className="w-px h-5 bg-gray-200" />
          {['ALL', 'UNCATEGORIZED', 'AI_SUGGESTED', 'CONFIRMED'].map(f => (
            <button key={f} onClick={() => setFilter(f === 'ALL' ? '' : f)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${filter === (f === 'ALL' ? '' : f) ? 'bg-klary-100 text-klary-700' : 'text-gray-500 hover:bg-gray-100'}`}>
              {f === 'ALL' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {quotaAtLimit && (
        <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span><strong>AI quota reached.</strong> Upgrade to KlarPro for unlimited AI categorization.</span>
          <a href="https://buy.stripe.com/klarpro" className="ml-4 text-xs font-semibold underline shrink-0">Upgrade →</a>
        </div>
      )}
      {quotaNearLimit && (
        <div className="rounded-lg p-3 bg-yellow-50 border border-yellow-200 text-sm text-yellow-800 flex items-center justify-between">
          <span><strong>{Math.round(quotaPct * 100)}% of AI quota used</strong> ({quota.used}/{quota.total}). Upgrade for unlimited AI.</span>
          <a href="https://buy.stripe.com/klarpro" className="ml-4 text-xs font-semibold underline shrink-0">Upgrade →</a>
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? <div className="p-8 text-center text-gray-400">Loading...</div> : (
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header w-24">Date</th>
                <th className="table-header">Description</th>
                <th className="table-header w-28">Amount</th>
                <th className="table-header w-32">Status</th>
                <th className="table-header w-56">AI Suggestion</th>
                <th className="table-header w-24 text-right pr-4 sticky right-0 bg-gray-50 shadow-[-8px_0_8px_-4px_rgba(0,0,0,0.06)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.transactions?.length === 0 && (
                <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-8">No transactions found.</td></tr>
              )}
              {data?.transactions?.map((tx: any) => (
                <tr key={tx.id} className="group hover:bg-gray-50">
                  <td className="table-cell text-gray-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="table-cell">{tx.description || '—'}</td>
                  <td className="table-cell font-medium whitespace-nowrap">{tx.amount.toLocaleString()} {tx.currency}</td>
                  <td className="table-cell"><span className={statusColors[tx.status] || 'badge-blue'}>{tx.status.replace(/_/g, ' ')}</span></td>
                  <td className="table-cell">
                    {tx.suggestedAccount ? (
                      <div className="flex items-center gap-1.5">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-klary-700">{tx.suggestedAccount}</span>
                          {tx.suggestedAccountName && (
                            <span className="text-xs text-gray-500 ml-1 truncate">· {tx.suggestedAccountName}</span>
                          )}
                          {tx.aiConfidence && (
                            <span className={`text-xs ml-1 ${tx.aiConfidence >= 0.8 ? 'text-emerald-600' : tx.aiConfidence >= 0.6 ? 'text-yellow-600' : 'text-gray-400'}`}>
                              {(tx.aiConfidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {tx.aiReasoning && (
                          <div className="relative shrink-0">
                            <button
                              onMouseEnter={() => setTooltip(tx.id)}
                              onMouseLeave={() => setTooltip(null)}
                              className="text-gray-400 hover:text-klary-600 transition-colors"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                            {tooltip === tx.id && (
                              <div className="absolute left-5 top-0 z-10 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl">
                                <p className="font-semibold mb-1 text-gray-300">AI Reasoning</p>
                                <p className="leading-relaxed">{tx.aiReasoning}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="table-cell text-right pr-4 sticky right-0 bg-white group-hover:bg-gray-50 shadow-[-8px_0_8px_-4px_rgba(0,0,0,0.06)]">
                    <div className="flex gap-2 justify-end">
                      {tx.status === 'UNCATEGORIZED' && (
                        <button onClick={() => categorizeMutation.mutate(tx.id)}
                          disabled={categorizeMutation.isLoading || quotaAtLimit}
                          title={quotaAtLimit ? 'AI quota reached — upgrade to continue' : undefined}
                          className="flex items-center gap-1 text-xs font-medium text-klary-600 hover:text-klary-700 bg-klary-50 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed">
                          <Sparkles className="w-3 h-3" /> AI
                        </button>
                      )}
                      {tx.status === 'AI_SUGGESTED' && (
                        <button onClick={() => confirmMutation.mutate({ id: tx.id, data: { account: tx.suggestedAccount, vatCode: tx.suggestedVatCode } })}
                          className="flex items-center gap-1 text-xs font-medium text-success-600 hover:text-success-700 bg-success-50 px-2 py-1 rounded">
                          <Check className="w-3 h-3" /> Confirm
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
