import { useState } from 'react'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mb_api_key') ?? '')

  const save = () => {
    if (apiKey) localStorage.setItem('mb_api_key', apiKey)
    else localStorage.removeItem('mb_api_key')
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-white">Settings</h1>
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
        <h2 className="text-sm font-medium text-slate-300">API Authentication</h2>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="mbk_..."
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
          />
        </div>
        <button
          onClick={save}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}
