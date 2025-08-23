'use client'

import { ReactNode } from 'react'
import { Navigation } from '@/components/navigation'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <Navigation />
      
      {/* Main content area */}
      <main className="relative">
        {/* Full-width content container */}
        <div className="w-full">
          <div className="bg-white min-h-[calc(100vh-140px)]">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}