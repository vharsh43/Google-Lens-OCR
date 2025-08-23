'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  Menu,
  X,
  FileText,
  Home,
  Trash
} from 'lucide-react'

interface NavigationProps {
  className?: string
}

export function Navigation({ className = '' }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const navigation = [
    {
      name: 'Dashboard',
      href: '/',
      icon: Home,
      current: pathname === '/'
    },
    {
      name: 'Database Cleanup',
      href: '/cleanup',
      icon: Trash,
      current: pathname === '/cleanup'
    },
  ]

  return (
    <nav className={`bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50 ${className}`}>
      <div className="w-full px-6">
        <div className="flex justify-between h-16">
          {/* Logo and primary nav */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="p-2 bg-slate-900 rounded-lg group-hover:bg-slate-800 transition-colors duration-200">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-lg text-slate-900">OCR Platform</span>
                  <span className="text-xs text-slate-500 -mt-0.5">Smart Document Processing</span>
                </div>
              </Link>
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-2">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${item.current
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right side - Status indicator */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-green-700">System Online</span>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200 bg-white">
          <div className="px-6 pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-3 rounded-lg text-base font-medium transition-all duration-200
                    ${item.current
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                  `}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              )
            })}
          </div>
          
          {/* Mobile status indicator */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-center space-x-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-700">System Online</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

// Sidebar navigation for desktop layouts
export function SidebarNavigation({ className = '' }: NavigationProps) {
  const pathname = usePathname()

  const navigation = [
    {
      name: 'Dashboard',
      href: '/',
      icon: Home,
      current: pathname === '/'
    },
    {
      name: 'Database Cleanup',
      href: '/cleanup',
      icon: Trash,
      current: pathname === '/cleanup'
    },
  ]

  return (
    <div className={`w-64 bg-gray-50 h-full overflow-y-auto ${className}`}>
      <div className="p-4">
        <Link href="/" className="flex items-center space-x-2 mb-8">
          <FileText className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl">OCR Platform</span>
        </Link>
        
        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${item.current
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

    </div>
  )
}