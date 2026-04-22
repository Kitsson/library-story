import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Search, Plus, Phone, Mail } from 'lucide-react';
import { clientApi } from '@/services/api';
import toast from 'react-hot-toast';

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', orgNumber: '', email: '', phone: '', contactName: '', industry: '', size: 'SMALL' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(['clients', search], () => clientApi.list({ search }).then(r => r.data));

  const createMutation = useMutation((data: any) => clientApi.create(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('clients');
      setShowForm(false);
      setForm({ name: '', orgNumber: '', email: '', phone: '', contactName: '', industry: '', size: 'SMALL' });
      toast.success('Client created!');
    },
    onError: (err: any) => { toast.error(err.response?.data?.error || 'Failed to create client'); },
  });

  const sizeLabel = (s: string) => ({ MICRO: '1-5', SMALL: '6-20', MEDIUM: '21-100', LARGE: '100+' }[s] || s);
  const statusColor = (s: string) => ({ ACTIVE: 'badge-green', INACTIVE: 'badge-yellow', AT_RISK: 'badge-red', CHURNED: 'badge-red' }[s] || 'badge-blue');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search clients..." className="input pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </button>
      </div>

      {/* Add Client Form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Add New Client</h3>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input className="input" placeholder="Client name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <input className="input" placeholder="Org. Number" value={form.orgNumber} onChange={e => setForm(f => ({ ...f, orgNumber: e.target.value }))} />
            <input type="email" className="input" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className="input" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <input className="input" placeholder="Contact person" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
            <select className="input" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}>
              <option value="MICRO">Micro (1-5 employees)</option>
              <option value="SMALL">Small (6-20)</option>
              <option value="MEDIUM">Medium (21-100)</option>
              <option value="LARGE">Large (100+)</option>
            </select>
            <div className="sm:col-span-3 flex gap-3">
              <button type="submit" className="btn-primary" disabled={createMutation.isLoading}>Create Client</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Client Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading clients...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Industry</th>
                <th className="table-header">Size</th>
                <th className="table-header">Status</th>
                <th className="table-header">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.clients?.length === 0 && (
                <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">No clients found. Add your first client!</td></tr>
              )}
              {data?.clients?.map((client: any) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-klary-100 flex items-center justify-center text-klary-700 font-semibold text-sm">
                        {client.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        {client.orgNumber && <p className="text-xs text-gray-400">{client.orgNumber}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-gray-500">{client.industry || '—'}</td>
                  <td className="table-cell"><span className="badge-blue">{sizeLabel(client.size)}</span></td>
                  <td className="table-cell"><span className={statusColor(client.status)}>{client.status}</span></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-3 text-gray-400">
                      {client.email && <Mail className="w-4 h-4 hover:text-gray-600 cursor-pointer" />}
                      {client.phone && <Phone className="w-4 h-4 hover:text-gray-600 cursor-pointer" />}
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