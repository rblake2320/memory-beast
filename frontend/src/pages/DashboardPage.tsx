import { useStatus } from '../hooks/useStatus'
import HealthPanel from '../components/HealthPanel'
import StatsGrid from '../components/StatsGrid'
import { Brain } from 'lucide-react'

export default function DashboardPage() {
  const { status, loading } = useStatus()
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-sky-400" />
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
      </div>
      <StatsGrid status={status} />
      <HealthPanel status={status} loading={loading} />
    </div>
  )
}
