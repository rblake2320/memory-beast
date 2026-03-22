import { Outlet, NavLink } from 'react-router-dom'
import { Brain, Search, Database, Shield, Settings } from 'lucide-react'
import { cn } from '../lib/cn'

const NAV = [
  { to: '/dashboard', icon: Brain, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/memories', icon: Database, label: 'Memories' },
  { to: '/certificates', icon: Shield, label: 'Certificates' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <nav className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-sky-400" />
            <span className="text-lg font-bold text-white">Memory Beast</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">v0.13.0</p>
        </div>
        <div className="flex-1 p-2 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-sky-500/20 text-sky-400 font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
