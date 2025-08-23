'use client'

import { AppLayout } from '@/components/app-layout'
import { DatabaseCleanup } from '@/components/database/database-cleanup-advanced'

export default function CleanupPage() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Database Cleanup</h1>
              <p className="mt-2 text-gray-600">
                Manage and clean up database records and files. You can clean individual tables or all data at once.
              </p>
            </div>
            <DatabaseCleanup />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}