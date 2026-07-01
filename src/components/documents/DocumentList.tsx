'use client';

import { useState } from 'react';

type Document = {
  id: string;
  originalName: string;
  filename: string;
  status: string;
  mimeType: string;
  createdAt: number;
};

type EmbedState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; count: number }
  | { status: 'error'; message: string };

const STATUS_STYLES: Record<string, string> = {
  uploaded: 'bg-gray-100 text-gray-600',
  processing: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export function DocumentList({ documents }: { documents: Document[] }) {
  const [embedStates, setEmbedStates] = useState<Record<string, EmbedState>>({});

  async function handleEmbed(id: string) {
    setEmbedStates((prev) => ({ ...prev, [id]: { status: 'loading' } }));
    try {
      const res = await fetch(`/api/documents/${id}/embed`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setEmbedStates((prev) => ({
          ...prev,
          [id]: { status: 'error', message: data.error ?? 'Failed' },
        }));
        return;
      }
      setEmbedStates((prev) => ({
        ...prev,
        [id]: { status: 'done', count: data.embeddedChunks },
      }));
    } catch {
      setEmbedStates((prev) => ({
        ...prev,
        [id]: { status: 'error', message: 'Network error' },
      }));
    }
  }

  if (documents.length === 0) {
    return <p className="text-sm text-gray-400">No documents uploaded yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Uploaded</th>
            <th className="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {documents.map((doc) => {
            const es = embedStates[doc.id] ?? { status: 'idle' };
            return (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{doc.originalName}</td>
                <td className="px-4 py-3 text-gray-500">{doc.mimeType.split('/')[1]}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[doc.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {doc.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(doc.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEmbed(doc.id)}
                      disabled={es.status === 'loading'}
                      className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {es.status === 'loading' ? 'Embedding…' : 'Embed'}
                    </button>
                    {es.status === 'loading' && (
                      <span className="text-xs text-gray-500">
                        Embedding may take longer the first time because the local model needs to load.
                      </span>
                    )}
                    {es.status === 'done' && (
                      <span className="text-xs text-green-600">
                        {es.count === 0 ? 'Already embedded' : `Embedded ${es.count} chunks`}
                      </span>
                    )}
                    {es.status === 'error' && (
                      <span className="text-xs text-red-600">{es.message}</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
