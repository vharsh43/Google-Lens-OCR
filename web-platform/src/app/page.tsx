'use client'

import { AppLayout } from '@/components/app-layout'
import { UnifiedDashboard } from '@/components/dashboard/UnifiedDashboard'

export default function HomePage() {
  return (
    <AppLayout>
      <UnifiedDashboard />
    </AppLayout>
  )
}