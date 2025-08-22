'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/app-layout'
import { WelcomeSection } from '@/components/dashboard/welcome-section'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RecentJobs } from '@/components/dashboard/recent-jobs'
import { QuickUpload } from '@/components/dashboard/quick-upload'
import { LoadingState } from '@/components/loading-states'
import { useToast } from '@/components/toast-provider'

interface DashboardData {
  stats: {
    totalJobs: number
    processingJobs: number
    completedJobs: number
    failedJobs: number
    totalFiles: number
    successRate: number
  }
  recentJobs: any[]
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    let isMounted = true

    const loadDashboardData = async () => {
      try {
        // Fetch dashboard statistics
        const [statsResponse, jobsResponse] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/jobs?limit=10')
        ])

        let stats = {
          totalJobs: 0,
          processingJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          totalFiles: 0,
          successRate: 0
        }
        let recentJobs: any[] = []

        // Handle stats - if endpoint doesn't exist, show default values
        if (statsResponse.ok) {
          stats = await statsResponse.json()
        } else if (statsResponse.status !== 404) {
          console.warn('Dashboard stats endpoint returned:', statsResponse.status)
        }

        // Handle jobs - if endpoint doesn't exist, show empty state
        if (jobsResponse.ok) {
          const jobsData = await jobsResponse.json()
          recentJobs = jobsData.jobs || []
        } else if (jobsResponse.status !== 404) {
          console.warn('Jobs endpoint returned:', jobsResponse.status)
        }

        if (isMounted) {
          setData({ stats, recentJobs })
        }
      } catch (error) {
        console.error('Dashboard data loading error:', error)
        if (isMounted) {
          setError('Failed to load dashboard data')
          // Still show the dashboard with empty stats
          setData({
            stats: {
              totalJobs: 0,
              processingJobs: 0,
              completedJobs: 0,
              failedJobs: 0,
              totalFiles: 0,
              successRate: 0
            },
            recentJobs: []
          })
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-8">
        {/* Welcome Section */}
        <WelcomeSection />

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-yellow-800 text-sm">
              ⚠️ Some dashboard data could not be loaded. The platform is still fully functional.
            </p>
          </div>
        )}

        {/* Stats Overview */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Overview</h2>
          <StatsCards 
            stats={data?.stats || {
              totalJobs: 0,
              processingJobs: 0,
              completedJobs: 0,
              failedJobs: 0,
              totalFiles: 0,
              successRate: 0
            }} 
            loading={loading} 
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Upload - spans 2 columns on large screens */}
          <QuickUpload />
          
          {/* Recent Jobs - spans 1 column */}
          <div className="lg:col-span-1">
            <RecentJobs 
              jobs={data?.recentJobs || []} 
              loading={loading} 
            />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}