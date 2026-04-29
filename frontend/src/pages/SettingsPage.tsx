import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '@/hooks/useAuth';
import { emailSettingsApi } from '@/services/api';
import { Building2, Shield, Users, CreditCard, Mail, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const SMTP_PRESETS: Record<string, { host: string; port: number; secure: boolean; label: string }> = {
  gmail:   { host: 'smtp.gmail.com',      port: 587, secure: false, label: 'Gmail' },
  outlook: { host: 'smtp.office365.com',  port: 587, secure: false, label: 'Outlook / M365' },
  zoho:    { host: 'smtp.zoho.eu',        port: 587, secure: false, label: 'Zoho Mail' },
  custom:  { host: '',                    port: 587, secure: true,  label: 'Custom SMTP' },
};

export function SettingsPage() {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState('resend');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: emailData } = useQuery('email-settings', () => emailSettingsApi.get().then(r => r.data));

  const [form, setForm] = useState({
    resendApiKey: '',
    smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '',
    smtpFrom: '', smtpFromName: '', smtpSecure: true, emailNotifyOnUpload: true,
  });

  const [formLoaded, setFormLoaded] = useState(false);
  if (emailData && !formLoaded) {
    setForm({ ...emailData.settings, smtpPass: '' });
    setFormLoaded(true);
  }

  const saveMutation = useMutation(emailSettingsApi.save, {
    onSuccess: () => {
      queryClient.invalidateQueries('email-settings');
      setFormLoaded(false);
      toast.success('Email settings saved!');
    },
    onError: (e: any) => { toast.error(e.response?.data?.error || 'Save failed'); },
  });

  const testMutation = useMutation(emailSettingsApi.test, {
    onSuccess: (r) => setTestResult({ ok: true, message: r.data.message }),
    onError: (e: any) => setTestResult({ ok: false, message: e.response?.data?.error || 'Connection failed' }),
  });

  function applyPreset(key: string) {
    setPreset(key);
    const p = SMTP_PRESETS[key];
    if (p.host) setForm(f => ({ ...f, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure }));
  }

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

      {/* Email Settings */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-klary-600" />
              <h3 className="font-semibold text-gray-900">Email Settings</h3>
            </div>
            {emailData?.configured && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> Configured
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">Connect your firm's email to send document requests and receive upload notifications.</p>
        </div>
        <div className="card-body space-y-5">
          {/* Provider tabs */}
          <div>
            <label className="label mb-2">Email Provider</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'resend', label: 'Resend (recommended)' },
                { key: 'gmail', label: 'Gmail' },
                { key: 'outlook', label: 'Outlook / M365' },
                { key: 'zoho', label: 'Zoho' },
                { key: 'custom', label: 'Custom SMTP' },
              ].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => applyPreset(key)}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${preset === key ? 'border-klary-500 bg-klary-50 text-klary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            {preset === 'resend' && (
              <p className="text-xs text-klary-600 mt-2">Works on all hosting providers. Free 3,000 emails/month. <a className="underline font-medium" href="https://resend.com" target="_blank" rel="noreferrer">Get a free API key →</a></p>
            )}
            {preset === 'gmail' && (
              <p className="text-xs text-amber-600 mt-2">Requires an App Password (not your regular password). <a className="underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">Create one here →</a></p>
            )}
          </div>

          {/* Resend fields */}
          {preset === 'resend' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Resend API Key</label>
                <input className="input font-mono text-sm" placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                  value={form.resendApiKey} onChange={e => setForm(f => ({ ...f, resendApiKey: e.target.value }))} />
              </div>
              <div>
                <label className="label">From Email <span className="text-gray-400 font-normal">(must be verified in Resend)</span></label>
                <input className="input" placeholder="info@yourfirm.com" value={form.smtpFrom} onChange={e => setForm(f => ({ ...f, smtpFrom: e.target.value }))} />
              </div>
              <div>
                <label className="label">From Name</label>
                <input className="input" placeholder="Lindqvist Redovisning" value={form.smtpFromName} onChange={e => setForm(f => ({ ...f, smtpFromName: e.target.value }))} />
              </div>
            </div>
          )}

          {/* SMTP fields */}
          {preset !== 'resend' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">SMTP Host</label>
                <input className="input" placeholder="smtp.gmail.com" value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))} />
              </div>
              <div>
                <label className="label">Port</label>
                <input type="number" className="input" placeholder="587" value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: parseInt(e.target.value) || 587 }))} />
              </div>
              <div>
                <label className="label">Username / Email</label>
                <input className="input" placeholder="you@yourfirm.com" value={form.smtpUser} onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))} />
              </div>
              <div>
                <label className="label">Password / App Password</label>
                <input type="password" className="input" placeholder={emailData?.configured ? '(saved — enter to update)' : 'Enter password'} value={form.smtpPass} onChange={e => setForm(f => ({ ...f, smtpPass: e.target.value }))} />
              </div>
              <div>
                <label className="label">From Email</label>
                <input className="input" placeholder="info@yourfirm.com" value={form.smtpFrom} onChange={e => setForm(f => ({ ...f, smtpFrom: e.target.value }))} />
              </div>
              <div>
                <label className="label">From Name</label>
                <input className="input" placeholder="Lindqvist Redovisning" value={form.smtpFromName} onChange={e => setForm(f => ({ ...f, smtpFromName: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.smtpSecure} onChange={e => setForm(f => ({ ...f, smtpSecure: e.target.checked }))} />
              Use SSL/TLS
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.emailNotifyOnUpload} onChange={e => setForm(f => ({ ...f, emailNotifyOnUpload: e.target.checked }))} />
              Notify me when clients upload documents
            </label>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {testResult.message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isLoading}
              className="btn-primary"
            >
              {saveMutation.isLoading ? 'Saving…' : 'Save Settings'}
            </button>
            <button
              onClick={() => { setTestResult(null); testMutation.mutate(undefined); }}
              disabled={testMutation.isLoading || !emailData?.configured}
              className="btn-secondary"
            >
              {testMutation.isLoading ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        </div>
      </div>

      {/* SMS / Twilio */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-klary-600" />
              <h3 className="font-semibold text-gray-900">SMS Settings</h3>
            </div>
            <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
              Platform-level
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">SMS document requests are sent via Twilio, configured at the server level by your administrator.</p>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SMS Quota</label>
              <p className="text-gray-900 font-medium">
                {current.features.find(f => f.includes('SMS')) || 'See plan features'}
              </p>
            </div>
            <div>
              <label className="label">Provider</label>
              <p className="text-gray-900">Twilio</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            To send SMS document requests, go to <strong>Documents</strong> → create a new request and select <strong>SMS</strong> as the channel. Clients receive a direct link to upload documents.
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
