import { useQuery } from 'react-query';
import {
  Clock, TrendingUp, Users, FileText, AlertTriangle,
  Zap, MessageSquare, ChevronRight
} from 'lucide-react';
import { dashboardApi, advisoryApi } from '@/services/api';
import { Link } from 'react-router-dom';

function StatCard({ title, value, subtitle, icon: Icon, color, href }: {
  title: string; value: string; subtitle: string; icon: any; color: string; href: string;
}) {
  return (
    <Link to={href} className="stat-card hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>
      <div className="mt-4">
        <p className="stat-value">{value}</p>
        <p className="stat-label">{title}</p>
        <p className="text-xs text-success-600 mt-1 font-medium">{subtitle}</p>
      </div>
    </Link>
  );
}

function QuickAction({ icon: Icon, label, desc, href, color }: {
  icon: any; label: string; desc: string; href: string; color: string;
}) {
  return (
    <Link to={href} className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-klary-300 hover:bg-klary-50 transition-all group">
      <div className={`p-2.5 rounded-lg ${color} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-medium text-gray-900 group-hover:text-klary-700">{label}</p>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { data: summary } = useQuery('dashboard-summary', () => dashboardApi.summary().then(r => r.data), { refetchInterval: 30000 });
  const { data: advisoryDash } = useQuery('advisory-dashboard', () => advisoryApi.dashboard().then(r => r.data));

  const s = summary;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Good morning!</h2>
        <p className="text-gray-500 mt-1">Here's what's happening with your firm today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Time This Week" value={`${(s?.timeThisWeek?.hours || 0).toFixed(1)}h`}
          subtitle="Tracked automatically" icon={Clock} color="bg-blue-100 text-blue-600" href="/time-tracking" />
        <StatCard title="Active Clients" value={`${s?.clients?.active || 0}`}
          subtitle={`${s?.clients?.total || 0} total clients`} icon={Users} color="bg-emerald-100 text-emerald-600" href="/clients" />
        <StatCard title="Advisory Value" value={`${(advisoryDash?.openOpportunities || 0)} open`}
          subtitle={`${((advisoryDash?.estimatedValue || 0) / 1000).toFixed(0)}k SEK potential`} icon={TrendingUp}
          color="bg-amber-100 text-amber-600" href="/advisory" />
        <StatCard title="Pending Docs" value={`${s?.documents?.pending || 0}`}
          subtitle={`${s?.documents?.overdue || 0} overdue`} icon={FileText} color="bg-purple-100 text-purple-600" href="/documents" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction icon={FileText} label="Request Documents"
              desc="Send SMS document request to clients" href="/documents" color="bg-purple-100 text-purple-600" />
            <QuickAction icon={Zap} label="Categorize Transactions"
              desc="AI-powered transaction categorization" href="/transactions" color="bg-blue-100 text-blue-600" />
            <QuickAction icon={TrendingUp} label="Review Advisory Opportunities"
              desc={`${advisoryDash?.openOpportunities || 0} opportunities detected`} href="/advisory" color="bg-amber-100 text-amber-600" />
            <QuickAction icon={Clock} label="Log Time Entry"
              desc="Track your billable hours" href="/time-tracking" color="bg-emerald-100 text-emerald-600" />
          </div>

          {/* Advisory Opportunities Preview */}
          <div className="card mt-6">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <LightbulbPreview />
                <h3 className="font-semibold text-gray-900">Advisory Opportunities</h3>
              </div>
              <Link to="/advisory" className="text-sm text-klary-600 hover:text-klary-700 font-medium">View all</Link>
            </div>
            <div className="card-body">
              {advisoryDash?.byType && advisoryDash.byType.length > 0 ? (
                <div className="space-y-3">
                  {advisoryDash.byType.slice(0, 4).map((item: any) => (
                    <div key={item.type} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-klary-500"></div>
                        <span className="text-sm text-gray-700">{item.type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">{item._count.id} opportunities</span>
                        <span className="text-sm font-medium text-gray-900">{((item._sum.estimatedValue || 0) / 1000).toFixed(0)}k SEK</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2" />
                  <p className="font-medium text-gray-600">No advisory opportunities yet.</p>
                  <p className="text-sm mt-1 max-w-xs mx-auto">KLARY detects advisory opportunities in your existing client base — 30–50% more billable work, zero extra effort.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quota Usage */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900">Usage This Month</h3>
            </div>
            <div className="card-body space-y-4">
              {s?.quota && (
                <>
                  <QuotaBar label="AI Operations" used={s.quota.ai.used} total={s.quota.ai.total} />
                  <QuotaBar label="SMS Requests" used={s.quota.sms.used} total={s.quota.sms.total} />
                  <QuotaBar label="Clients" used={s.clients.total} total={s.quota.clients} />
                  {s.quota.ai.total > 0 && s.quota.ai.used / s.quota.ai.total >= 0.8 && (
                    <div className={`rounded-lg p-3 text-xs ${s.quota.ai.used >= s.quota.ai.total ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-800'}`}>
                      {s.quota.ai.used >= s.quota.ai.total
                        ? <><strong>AI quota reached.</strong> Upgrade to KlarPro for unlimited AI categorization.</>
                        : <><strong>80% of AI quota used.</strong> Upgrade to KlarPro for unlimited AI.</>
                      }
                      {' '}<a href="https://buy.stripe.com/klarpro" className="underline font-semibold">Upgrade →</a>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Alerts */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning-500" />
                Alerts
              </h3>
            </div>
            <div className="card-body space-y-3">
              {(s?.documents?.overdue || 0) > 0 && (
                <div className="flex items-start gap-3 p-3 bg-danger-50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-danger-500 mt-1.5 shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-danger-800">{s.documents.overdue} overdue document requests</p>
                    <p className="text-xs text-danger-600 mt-0.5">Clients haven't submitted required documents</p>
                  </div>
                </div>
              )}
              {(advisoryDash?.openOpportunities || 0) > 0 && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-amber-800">{advisoryDash.openOpportunities} advisory opportunities waiting</p>
                    <p className="text-xs text-amber-600 mt-0.5">Potential revenue: {((advisoryDash?.estimatedValue || 0) / 1000).toFixed(0)}k SEK</p>
                  </div>
                </div>
              )}
              {(s?.documents?.overdue || 0) === 0 && (advisoryDash?.openOpportunities || 0) === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">All clear! No alerts.</p>
              )}
            </div>
          </div>

          {/* KLARY Value Prop */}
          <div className="card bg-gradient-to-br from-klary-50 to-white border-klary-200">
            <div className="card-body">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-klary-600" />
                <span className="text-sm font-semibold text-klary-800">Did you know?</span>
              </div>
              <p className="text-sm text-gray-600">
                The average KLARY firm recovers <span className="font-semibold text-klary-700">300+ billable hours per year</span> — at 1,200 kr/h that's 360,000 kr in recaptured revenue.
              </p>
              <p className="text-xs text-gray-400 mt-2">Connect your data under <Link to="/integrations" className="text-klary-600 font-medium">Integrations</Link> to get started.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuotaBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-emerald-500';
  const textColor = pct >= 80 ? 'text-red-600' : pct >= 60 ? 'text-yellow-600' : 'text-gray-900';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={`font-medium ${textColor}`}>{used} / {total}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}

function LightbulbPreview() {
  return (
    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}