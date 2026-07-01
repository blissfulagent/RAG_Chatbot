'use client';

import { useRef, useState } from 'react';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function DocumentUploader({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [message, setMessage] = useState('');

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setState('uploading');
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setState('error');
        setMessage(data.error ?? 'Upload failed');
        return;
      }
      setState('success');
      setMessage(`Uploaded "${data.document.originalName}" — ${data.document.chunkCount} chunks`);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded();
    } catch {
      setState('error');
      setMessage('Network error');
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700">Upload Document</h2>
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="flex-1 text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />
        <button
          onClick={handleUpload}
          disabled={state === 'uploading'}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {state === 'uploading' ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      <p className="text-xs text-gray-500">PDF, TXT, or MD — max 10 MB</p>
      {message && (
        <p className={`text-xs ${state === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
