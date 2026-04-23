import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Send, FileText, Bell, CheckCircle, Clock, XCircle } from 'lucide-react';
import { documentApi, clientApi } from '@/services/api';
import toast from 'react-hot-toast';

export function DocumentRequestsPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [form, setForm] = useState({ clientId: '', title: '', description: '', channel: 'sms' as string, dueDate: '', items: [{ name: '', description: '', required: true }] });
  const queryClient = useQueryClient();

  const { data: requests } = useQuery('document-requests', () => documentApi.list().then(r => r.data));
  const { data: clients } = useQuery('doc-clients', () => clientApi.list().then(r => r.data));
  const { data: templatesData } = useQuery('doc-templates', () => documentApi.templates().then(r => r.data));

  const createMutation = useMutation(documentApi.create, {
    onSuccess: () => { queryClient.invalidateQueries('document-requests'); setShowForm(false); toast.success('Document request sent!'); },
  });

  const reminderMutation = useMutation((id: string) => documentApi.sendReminder(id), {
    onSuccess: () => { queryClient.invalidateQueries('document-requests'); toast.success('Reminder sent!'); },
  });

  const selectTemplate = (templateId: string) => {
    const tmpl = templatesData?.templates?.find((t: any) => t.id === templateId);
    if (tmpl) {
      setForm(f => ({ ...f, title: tmpl.name, description: tmpl.description, items: tmpl.items }));
      setSelectedTemplate(templateId);
    }
  };

  const statusIcons: Record<string, any> = {
    SENT: Clock, PARTIAL: Bell, COMPLETED: CheckCircle, OVERDUE: XCircle, DRAFT: FileText,
  };
  const statusColors: Record<string, string> = {
    SENT: 'text-amber-500', PARTIAL: 'text-klary-500', COMPLETED: 'text-emerald-500', OVERDUE: 'text-danger-500', DRAFT: 'text-gray-400',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h3 className="text-lg font-semibold text-gray-900">Document Requests</h3><p className="text-sm text-gray-500">SMS-first document collection from clients</p></div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary"><Send className="w-4 h-4 mr-2" /> New Request</button>
      </div>

      {showForm && (
        <div className="card p-6 space-y-4">
          <h4 className="font-semibold text-gray-900">Send Document Request</h4>

          {/* Template selector */}
          <div>
            <label className="label">Quick Template</label>
            <div className="flex gap-2 flex-wrap">
              {templatesData?.templates?.map((t: any) => (
                <button key={t.id} onClick={() => selectTemplate(t.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${selectedTemplate === t.id ? 'border-klary-500 bg-klary-50 text-klary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select className="input" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required>
              <option value="">Select client *</option>
              {clients?.clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="input" placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            <input className="input" placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary" disabled={createMutation.isLoading}><Send className="w-4 h-4 mr-2" />Send Request</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr><th className="table-header">Client</th><th className="table-header">Request</th><th className="table-header">Status</th><th className="table-header">Due Date</th><th className="table-header">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests?.requests?.length === 0 && (
              <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">No document requests yet.</td></tr>
            )}
            {requests?.requests?.map((req: any) => {
              const StatusIcon = statusIcons[req.status] || FileText;
              return (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-gray-900">{req.client?.name}</td>
                  <td className="table-cell">{req.title}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`w-4 h-4 ${statusColors[req.status] || 'text-gray-400'}`} />
                      <span className={statusColors[req.status] ? '' : 'text-gray-500'}>{req.status}</span>
                    </div>
                  </td>
                  <td className="table-cell text-gray-500">{req.dueDate ? new Date(req.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="table-cell">
                    {(req.status === 'SENT' || req.status === 'PARTIAL') && (
                      <button onClick={() => reminderMutation.mutate(req.id)} disabled={reminderMutation.isLoading}
                        className="text-sm text-klary-600 hover:text-klary-700 font-medium">Send Reminder</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}