import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Sparkles, Check, Download, Database } from 'lucide-react';
import { transactionApi } from '@/services/api';
import toast from 'react-hot-toast';

export function TransactionsPage() {
  const [filter, setFilter] = useState('UNCATEGORIZED');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(['transactions', filter], () => transactionApi.list({ status: filter }).then(r => r.data));

  const categorizeMutation = useMutation((id: string) => transactionApi.categorize(id), {
    onSuccess: () => { queryClient.invalidateQueries('transactions'); toast.success('AI categorized!'); },
  });

  const confirmMutation = useMutation(({ id, data }: any) => transactionApi.confirm(id, data), {
    onSuccess: () => { queryClient.invalidateQueries('transactions'); toast.success('Confirmed!'); },
  });

  const seedMutation = useMutation(() => transactionApi.seedDemo(), {
    onSuccess: (res) => {
      queryClient.invalidateQueries('transactions');
      setFilter('UNCATEGORIZED');
      toast.success(res.data.message);
    },
    onError: () => toast.error('Could not load demo data.'),
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

      <div className="card overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Loading...</div> : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr><th className="table-header">Date</th><th className="table-header">Description</th><th className="table-header">Amount</th><th className="table-header">Status</th><th className="table-header">AI Suggestion</th><th className="table-header">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.transactions?.length === 0 && (
                <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-8">No transactions found.</td></tr>
              )}
              {data?.transactions?.map((tx: any) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="table-cell text-gray-500">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="table-cell">{tx.description || '—'}</td>
                  <td className="table-cell font-medium">{tx.amount.toLocaleString()} {tx.currency}</td>
                  <td className="table-cell"><span className={statusColors[tx.status] || 'badge-blue'}>{tx.status.replace(/_/g, ' ')}</span></td>
                  <td className="table-cell">
                    {tx.suggestedAccount ? (
                      <div>
                        <span className="text-sm font-medium text-klary-700">{tx.suggestedAccount}</span>
                        {tx.aiConfidence && <span className="text-xs text-gray-400 ml-2">{(tx.aiConfidence * 100).toFixed(0)}% confidence</span>}
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      {tx.status === 'UNCATEGORIZED' && (
                        <button onClick={() => categorizeMutation.mutate(tx.id)} disabled={categorizeMutation.isLoading}
                          className="flex items-center gap-1 text-xs font-medium text-klary-600 hover:text-klary-700 bg-klary-50 px-2 py-1 rounded">
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