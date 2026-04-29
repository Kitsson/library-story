import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Lightbulb, TrendingUp, CircleDollarSign, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { advisoryApi } from '@/services/api';

export function AdvisoryPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: dashboard } = useQuery('advisory-dashboard', () => advisoryApi.dashboard().then(r => r.data));
  const { data: opps } = useQuery('advisory-opportunities', () => advisoryApi.opportunities().then(r => r.data));

  const updateMutation = useMutation(({ id, data }: any) => advisoryApi.updateOpportunity(id, data), {
    onSuccess: () => queryClient.invalidateQueries(['advisory-opportunities', 'advisory-dashboard']),
  });

  const typeLabels: Record<string, string> = {
    CASH_FLOW: 'Cash Flow', TAX_PLANNING: 'Tax Planning', VIRTUAL_CFO: 'Virtual CFO',
    YEAR_END: 'Year-End', PAYROLL: 'Payroll', GROWTH: 'Growth', COST_REDUCTION: 'Cost Reduction',
    COMPLIANCE: 'Compliance', CUSTOM: 'Custom',
  };

  const statusColors: Record<string, string> = {
    OPEN: 'badge-blue', IN_PROGRESS: 'badge-yellow', PROPOSAL_SENT: 'badge-purple',
    CONVERTED: 'badge-green', DISMISSED: 'badge-red', SNOOZED: 'badge-yellow',
  };

  const priorityColors: Record<string, string> = { LOW: 'text-gray-500', MEDIUM: 'text-warning-600', HIGH: 'text-danger-600', CRITICAL: 'text-danger-700' };
  const priorityBg: Record<string, string> = { LOW: 'bg-gray-100', MEDIUM: 'bg-yellow-100', HIGH: 'bg-red-100', CRITICAL: 'bg-red-200' };

  const parseEvidence = (raw: any): { content?: string; topics?: string[] } => {
    if (!raw) return {};
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return {}; }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg"><Lightbulb className="w-5 h-5 text-amber-600" /></div>
            <div><p className="stat-value">{dashboard?.openOpportunities || 0}</p><p className="stat-label">Open Opportunities</p></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="stat-value">{((dashboard?.totalConvertedValue || 0) / 1000).toFixed(0)}k</p><p className="stat-label">SEK Converted This Month</p></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-klary-100 rounded-lg"><Target className="w-5 h-5 text-klary-600" /></div>
            <div><p className="stat-value">{dashboard?.convertedThisMonth || 0}</p><p className="stat-label">Converted This Month</p></div>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold text-gray-900">Opportunity Pipeline</h3></div>
        <div className="divide-y divide-gray-100">
          {opps?.opportunities?.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <Lightbulb className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium text-gray-600">No advisory opportunities detected yet.</p>
              <p className="text-sm mt-1 max-w-sm mx-auto">KLARY detects advisory opportunities in your existing client base — 30–50% more billable work, zero extra effort.</p>
            </div>
          )}
          {opps?.opportunities?.map((opp: any) => {
            const ev = parseEvidence(opp.evidence);
            const conf = opp.aiConfidence ? Math.round(opp.aiConfidence * 100) : null;
            const confColor = conf ? (conf >= 80 ? 'text-emerald-600' : conf >= 60 ? 'text-yellow-600' : 'text-gray-500') : '';
            const isExpanded = expanded === opp.id;

            return (
              <div key={opp.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-gray-900">{opp.title}</h4>
                      <span className={statusColors[opp.status] || 'badge-blue'}>{opp.status.replace(/_/g, ' ')}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityBg[opp.priority] || 'bg-gray-100'} ${priorityColors[opp.priority] || ''}`}>
                        {opp.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{opp.client?.name} • {typeLabels[opp.type] || opp.type}</p>
                    {opp.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{opp.description}</p>}
                    <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                      <span className="text-gray-500">{opp.estimatedHours}h estimated</span>
                      <span className="font-medium text-emerald-600">{opp.estimatedValue?.toLocaleString()} SEK</span>
                      {conf && <span className={`${confColor} font-medium`}>{conf}% AI confidence</span>}
                      {(ev.content || (ev.topics && ev.topics.length > 0)) && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : opp.id)}
                          className="flex items-center gap-1 text-klary-600 hover:text-klary-700 font-medium"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          Why?
                        </button>
                      )}
                    </div>

                    {isExpanded && (ev.content || (ev.topics && ev.topics.length > 0)) && (
                      <div className="mt-3 p-3 bg-klary-50 border border-klary-100 rounded-lg space-y-2">
                        {ev.topics && ev.topics.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-klary-700">Detected topics:</span>
                            {ev.topics.map((t: string) => (
                              <span key={t} className="text-xs bg-klary-100 text-klary-800 px-2 py-0.5 rounded-full">{t}</span>
                            ))}
                          </div>
                        )}
                        {ev.content && (
                          <div>
                            <p className="text-xs font-semibold text-klary-700 mb-1">Evidence from client communication:</p>
                            <p className="text-xs text-gray-600 italic leading-relaxed">"{ev.content.substring(0, 300)}{ev.content.length > 300 ? '…' : ''}"</p>
                          </div>
                        )}
                        {conf && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">AI confidence:</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-24">
                              <div className={`h-1.5 rounded-full ${conf >= 80 ? 'bg-emerald-500' : conf >= 60 ? 'bg-yellow-500' : 'bg-gray-400'}`} style={{ width: `${conf}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${confColor}`}>{conf}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    {opp.status === 'OPEN' && (
                      <>
                        <button onClick={() => updateMutation.mutate({ id: opp.id, data: { status: 'IN_PROGRESS' } })}
                          className="btn-primary text-xs px-3 py-1.5">Start</button>
                        <button onClick={() => updateMutation.mutate({ id: opp.id, data: { status: 'DISMISSED' } })}
                          className="btn-secondary text-xs px-3 py-1.5">Dismiss</button>
                      </>
                    )}
                    {opp.status === 'IN_PROGRESS' && (
                      <button onClick={() => updateMutation.mutate({ id: opp.id, data: { status: 'CONVERTED' } })}
                        className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                        <CircleDollarSign className="w-3 h-3" /> Convert
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
