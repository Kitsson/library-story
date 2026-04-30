import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { fortnoxApi } from '@/services/api';
import { CheckCircle, RefreshCw, Unplug, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const OTHER_PROVIDERS = [
  { id: 'VISMA_EEKONOMI', name: 'Visma eEkonomi', description: 'Swedish cloud accounting', country: 'SE' },
  { id: 'BJORN_LUNDEN', name: 'Björn Lundén', description: 'Swedish payroll & accounting', country: 'SE' },
  { id: 'ECONOMIC', name: 'e-conomic', description: 'Nordic cloud accounting', country: 'SE / DK / NO' },
  { id: 'TRIPLETEX', name: 'Tripletex', description: 'Norwegian accounting', country: 'NO' },
  { id: 'BOKIO', name: 'Bokio', description: 'Swedish small business accounting', country: 'SE' },
];

export function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery('fortnox-status', () => fortnoxApi.status().then(r => r.data));
  const connected = data?.connected ?? false;
  const integration = data?.integration;

  // Handle OAuth callback result in URL
  useEffect(() => {
    if (searchParams.get('connected') === 'fortnox') {
      toast.success('Fortnox connected! Click "Sync Now" to import your clients and invoices.');
      queryClient.invalidateQueries('fortnox-status');
      setSearchParams({});
    }
    if (searchParams.get('error')) {
      const errMap: Record<string, string> = {
        fortnox_denied: 'Fortnox authorization was cancelled.',
        invalid_state: 'Authorization link expired — please try again.',
        fortnox_exchange_failed: 'Failed to connect Fortnox. Please try again.',
      };
      toast.error(errMap[searchParams.get('error')!] || 'Connection failed.');
      setSearchParams({});
    }
  }, []);

  const connectMutation = useMutation(
    async () => {
      const resp = await fortnoxApi.authorizeUrl();
      window.location.href = resp.data.url;
    },
    { onError: (e: any) => { toast.error(e.response?.data?.error || 'Failed to start authorization'); } }
  );

  const syncMutation = useMutation(() => fortnoxApi.sync().then(r => r.data), {
    onSuccess: (data) => {
      queryClient.invalidateQueries('fortnox-status');
      const msg = `Sync complete — ${data.clients} new clients, ${data.transactions} transactions imported.`;
      if (data.errors?.length) {
        toast(msg + ` (${data.errors.length} warning${data.errors.length > 1 ? 's' : ''})`, { icon: '⚠️' });
      } else {
        toast.success(msg);
      }
    },
    onError: (e: any) => { toast.error(e.response?.data?.error || 'Sync failed'); },
  });

  const disconnectMutation = useMutation(() => fortnoxApi.disconnect().then(r => r.data), {
    onSuccess: () => {
      queryClient.invalidateQueries('fortnox-status');
      toast.success('Fortnox disconnected.');
    },
    onError: (e: any) => { toast.error(e.response?.data?.error || 'Disconnect failed'); },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Integrations</h3>
        <p className="text-sm text-gray-500">Connect your accounting software to sync clients and transactions automatically.</p>
      </div>

      {/* Fortnox card */}
      <div className={`card border-2 ${connected ? 'border-emerald-200' : 'border-gray-200'}`}>
        <div className="card-body">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
              FN
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-gray-900 text-base">Fortnox</h4>
                <span className="text-xs text-gray-400">Sweden's #1 accounting platform</span>
                {connected && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Connected
                  </span>
                )}
                {integration?.status === 'ERROR' && (
                  <span className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Sync error
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-500 mt-1">
                Automatically sync clients and invoices from Fortnox into KLARY. New clients and transactions appear instantly after sync.
              </p>

              {connected && integration?.lastSyncAt && (
                <p className="text-xs text-gray-400 mt-1">
                  Last synced: {new Date(integration.lastSyncAt).toLocaleString('sv-SE')}
                </p>
              )}

              {!isLoading && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {connected ? (
                    <>
                      <button
                        className="btn-primary text-sm"
                        onClick={() => syncMutation.mutate()}
                        disabled={syncMutation.isLoading}
                      >
                        {syncMutation.isLoading
                          ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> Syncing…</>
                          : <><RefreshCw className="w-4 h-4 mr-1.5 inline" /> Sync Now</>
                        }
                      </button>
                      <button
                        className="btn-secondary text-sm text-red-600 hover:border-red-300"
                        onClick={() => { if (confirm('Disconnect Fortnox? Existing synced data will not be deleted.')) disconnectMutation.mutate(); }}
                        disabled={disconnectMutation.isLoading}
                      >
                        <Unplug className="w-4 h-4 mr-1.5 inline" />
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-primary text-sm"
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isLoading}
                    >
                      {connectMutation.isLoading
                        ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> Redirecting…</>
                        : <><ExternalLink className="w-4 h-4 mr-1.5 inline" /> Connect Fortnox</>
                      }
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* What gets synced info box */}
          {!connected && (
            <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-blue-700 space-y-1">
              <p className="font-medium">What gets synced:</p>
              <ul className="list-disc list-inside text-blue-600 space-y-0.5">
                <li>Customers → KLARY Clients (upsert by customer number)</li>
                <li>Customer Invoices → KLARY Transactions (ready for AI categorization)</li>
              </ul>
              <p className="text-xs text-blue-500 mt-1">You'll be redirected to Fortnox to authorize — takes about 30 seconds.</p>
            </div>
          )}

          {connected && (
            <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <p>Sync runs manually — click <strong>Sync Now</strong> to pull the latest data from Fortnox. New clients will appear in your Clients page and new transactions in Transactions.</p>
            </div>
          )}
        </div>
      </div>

      {/* Other integrations — coming soon */}
      <div className="card">
        <div className="card-header">
          <h4 className="font-semibold text-gray-900">More integrations — coming soon</h4>
          <p className="text-sm text-gray-500 mt-0.5">Vote for the next integration by contacting support.</p>
        </div>
        <div className="card-body space-y-2">
          {OTHER_PROVIDERS.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                {p.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-700 text-sm">{p.name}</p>
                <p className="text-xs text-gray-400">{p.description} · {p.country}</p>
              </div>
              <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded font-medium whitespace-nowrap">Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
