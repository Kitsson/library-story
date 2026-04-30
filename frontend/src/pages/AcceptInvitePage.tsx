import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authExtrasApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { loadUser } = useAuth();

  const [form, setForm] = useState({ firstName: '', lastName: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">Invalid invite link — no token found.</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 12) { setError('Password must be at least 12 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await authExtrasApi.acceptInvite({
        token,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
      });
      localStorage.setItem('accessToken', res.data.accessToken);
      if (res.data.refreshToken) localStorage.setItem('refreshToken', res.data.refreshToken);
      await loadUser();
      toast.success(`Welcome to ${res.data.organization?.name || 'KLARY'}!`);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create account. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-klary-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-klary-700 font-bold text-xl">K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Accept your invitation</h1>
          <p className="text-gray-500 mt-1 text-sm">Create your KLARY account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input
                className="input"
                placeholder="Anna"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Last name</label>
              <input
                className="input"
                placeholder="Lindqvist"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="At least 12 characters"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              type="password"
              className="input"
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
            {loading ? 'Creating account…' : 'Create account & join team'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-klary-600 font-medium">Sign in</a>
        </p>
      </div>
    </div>
  );
}
