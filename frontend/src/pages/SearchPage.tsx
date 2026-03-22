import { useState } from 'react'
import { Search } from 'lucide-react'
import { useSearch } from '../hooks/useSearch'
import MemoryCard from '../components/MemoryCard'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const { results, loading, error, search } = useSearch()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    search(query)
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-white">Search Memories</h1>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search across all memories..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {results.total} results · {results.latency_ms}ms · tiers [{results.tiers_used.join(', ')}]
          </p>
          <div className="space-y-2">
            {results.results.map(r => (
              <MemoryCard key={r.id} item={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
