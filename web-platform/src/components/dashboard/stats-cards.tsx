'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Activity,
  TrendingUp
} from 'lucide-react'

interface StatsData {
  totalJobs: number
  processingJobs: number
  completedJobs: number
  failedJobs: number
  totalFiles: number
  successRate: number
}

interface StatsCardsProps {
  stats: StatsData
  loading?: boolean
}

export function StatsCards({ stats, loading = false }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Jobs',
      value: stats.totalJobs,
      icon: FileText,
      description: 'All OCR jobs created',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Processing',
      value: stats.processingJobs,
      icon: Clock,
      description: 'Currently processing',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Completed',
      value: stats.completedJobs,
      icon: CheckCircle,
      description: 'Successfully completed',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Failed',
      value: stats.failedJobs,
      icon: AlertTriangle,
      description: 'Failed or errored',
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Total Files',
      value: stats.totalFiles,
      icon: Activity,
      description: 'Files processed',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Success Rate',
      value: `${Math.round(stats.successRate)}%`,
      icon: TrendingUp,
      description: 'Overall success rate',
      color: stats.successRate >= 90 ? 'text-green-600' : stats.successRate >= 70 ? 'text-orange-600' : 'text-red-600',
      bgColor: stats.successRate >= 90 ? 'bg-green-50' : stats.successRate >= 70 ? 'bg-orange-50' : 'bg-red-50'
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {card.value}
              </div>
              <p className="text-xs text-gray-500">
                {card.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}