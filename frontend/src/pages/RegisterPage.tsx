import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    orgName: '', orgNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match'); return;
    }
    if (form.password.length < 12) {
      toast.error('Password must be at least 12 characters'); return;
    }
    setLoading(true);
    try {
      await register({
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        password: form.password, orgName: form.orgName, orgNumber: form.orgNumber || undefined,
      });
      toast.success('Welcome to KLARY!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-klary-50 to-white px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-klary-600 mb-4">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Start your KLARY journey</h1>
          <p className="text-gray-500 mt-1">Free 14-day trial, no credit card required</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First Name</label>
                <input data-testid="register-firstName" className="input" value={form.firstName} onChange={e => update('firstName', e.target.value)} required />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input data-testid="register-lastName" className="input" value={form.lastName} onChange={e => update('lastName', e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input data-testid="register-email" type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Firm Name</label>
                <input data-testid="register-firmName" className="input" value={form.orgName} onChange={e => update('orgName', e.target.value)} required
                  placeholder="Lindqvist Redovisning" />
              </div>
              <div>
                <label className="label">Org. Number</label>
                <input className="input" value={form.orgNumber} onChange={e => update('orgNumber', e.target.value)}
                  placeholder="556123-4567" />
              </div>
            </div>
            <div>
              <label className="label">Password (min 12 chars)</label>
              <div className="relative">
                <input data-testid="register-password" type={showPassword ? 'text' : 'password'} className="input pr-10" value={form.password}
                  onChange={e => update('password', e.target.value)} required minLength={12} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input data-testid="register-confirmPassword" type="password" className="input" value={form.confirmPassword}
                onChange={e => update('confirmPassword', e.target.value)} required />
            </div>
            <button data-testid="register-submit" type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Start Free Trial'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-klary-600 hover:text-klary-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}