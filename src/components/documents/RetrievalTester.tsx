'use client';

import { useState } from 'react';

type Result = {
  chunkId: string;
  documentId: string;
  score: number;
  content: string;
};

export function RetrievalTester() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState('');

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const res = await fetch('/api/retrieval/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), topK: 5 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Retrieval failed');
        return;
      }
      setResults(data.results);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700">Retrieval Test</h2>
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter a query to search embedded chunks…"
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {results !== null && results.length === 0 && (
        <p className="text-xs text-gray-400">No results found. Make sure documents are embedded first.</p>
      )}
      {results && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((r, i) => (
            <div key={r.chunkId} className="rounded border border-gray-100 bg-gray-50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">#{i + 1} · score {r.score.toFixed(4)}</span>
                <span className="font-mono text-xs text-gray-400">{r.documentId.slice(0, 8)}…</span>
              </div>
              <p className="line-clamp-3 text-xs text-gray-700">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
