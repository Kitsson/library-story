import { useAuth } from '@/hooks/useAuth';
import { Building2, Shield, Users, CreditCard } from 'lucide-react';

export function SettingsPage() {
  const { user, organization } = useAuth();

  const tierInfo: Record<string, { name: string; price: string; features: string[] }> = {
    KLARSTART: { name: 'KlarStart', price: '795 kr/mo', features: ['Auto-Time Tracking', 'Smart Timesheets', 'AI Categorization (200/mo)', 'Client Portal (10 clients)', 'SMS (50/mo)'] },
    KLARPRO: { name: 'KlarPro', price: '1,495 kr/mo', features: ['Everything in KlarStart', 'AI Categorization (unlimited)', 'Client Portal (50 clients)', 'SMS (300/mo)', 'Advisory Engine', 'Proposal Generator'] },
    KLARFIRM: { name: 'KlarFirm', price: '3,995 kr/mo', features: ['Everything in KlarPro', 'Unlimited everything', 'Team Analytics', 'API Access', 'Priority Support'] },
  };

  const current = tierInfo[organization?.tier || 'KLARSTART'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Organization */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-klary-600" /><h3 className="font-semibold text-gray-900">Organization</h3></div>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Firm Name</label><p className="text-gray-900 font-medium">{organization?.name || '—'}</p></div>
            <div><label className="label">Organization Number</label><p className="text-gray-900">{user?.organizationId?.slice(0, 8) || '—'}</p></div>
            <div><label className="label">Current Plan</label><p className="text-klary-700 font-semibold">{current.name} <span className="text-gray-400 font-normal">({current.price})</span></p></div>
            <div><label className="label">Your Role</label><p className="text-gray-900 capitalize">{user?.role?.toLowerCase()}</p></div>
          </div>
        </div>
      </div>

      {/* Current Plan */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-klary-600" /><h3 className="font-semibold text-gray-900">Plan Features</h3></div>
        </div>
        <div className="card-body">
          <ul className="space-y-2">
            {current.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Security */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-klary-600" /><h3 className="font-semibold text-gray-900">Security</h3></div>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Email</label><p className="text-gray-900">{user?.email}</p></div>
            <div><label className="label">Two-Factor Auth</label><span className="badge-yellow">Coming Soon</span></div>
            <div><label className="label">Last Login</label><p className="text-gray-500">Active now</p></div>
            <div><label className="label">Password</label><button className="text-sm text-klary-600 font-medium">Change Password</button></div>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2"><Users className="w-5 h-5 text-klary-600" /><h3 className="font-semibold text-gray-900">Team</h3></div>
        </div>
        <div className="card-body">
          <p className="text-sm text-gray-500">Team management available in KlarPro and KlarFirm plans.</p>
        </div>
      </div>
    </div>
  );
}