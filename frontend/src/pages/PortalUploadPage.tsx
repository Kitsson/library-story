import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { api } from '@/services/api';
import { Upload, CheckCircle, FileText, AlertCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

export function PortalUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [allDone, setAllDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery(
    ['portal', token],
    () => api.get(`/uploads/portal/${token}`).then(r => r.data),
    { retry: false }
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        await api.post(`/uploads/portal/${token}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadedFiles(prev => [...prev, file.name]);
        toast.success(`${file.name} uploaded`);
      } catch (e: any) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    setAllDone(true);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-klary-500" />
      </div>
    );
  }

  if (error || !data) {
    const msg = (error as any)?.response?.data?.error || 'Invalid or expired upload link.';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link not valid</h1>
          <p className="text-gray-500">{msg}</p>
        </div>
      </div>
    );
  }

  const items: Array<{ name: string; required: boolean; uploaded: boolean }> = data.items || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-klary-600 text-white py-6 px-4">
        <div className="max-w-lg mx-auto">
          <p className="text-klary-200 text-sm font-medium mb-1">{data.firmName}</p>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          {data.description && <p className="text-klary-100 mt-1 text-sm">{data.description}</p>}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 mt-4">
        {/* Client greeting */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <p className="text-gray-700">
            Hi <strong>{data.clientName}</strong>, please upload the documents listed below.
            {data.dueDate && (
              <span className="text-amber-600"> Due by {new Date(data.dueDate).toLocaleDateString()}</span>
            )}
          </p>
        </div>

        {/* Document list */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Documents needed</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {items.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  {item.uploaded || uploadedFiles.length > 0 ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-gray-300 shrink-0" />
                  )}
                  <span className="text-sm text-gray-700 flex-1">{item.name}</span>
                  {item.required && <span className="text-xs text-red-500">Required</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upload area */}
        {allDone ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-emerald-800 mb-1">Documents uploaded!</h2>
            <p className="text-emerald-600 text-sm">
              {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} sent to {data.firmName}. You're all set.
            </p>
          </div>
        ) : (
          <div
            className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-200 p-8 text-center cursor-pointer hover:border-klary-400 hover:bg-klary-50 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          >
            {uploading ? (
              <Loader className="w-10 h-10 animate-spin text-klary-400 mx-auto mb-3" />
            ) : (
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            )}
            <p className="text-gray-700 font-medium mb-1">
              {uploading ? 'Uploading…' : 'Tap to upload or drag files here'}
            </p>
            <p className="text-xs text-gray-400">PDF, images, Word, Excel — max 10MB each</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>
        )}

        {/* Uploaded list */}
        {uploadedFiles.length > 0 && !allDone && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            {uploadedFiles.map((name, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle className="w-4 h-4" /> {name}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-6">
          Secure upload powered by {data.firmName} · KLARY
        </p>
      </div>
    </div>
  );
}
