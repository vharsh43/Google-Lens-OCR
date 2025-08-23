'use client'

import React, { Component, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class UploadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Upload Error Boundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="max-w-2xl mx-auto mt-8">
          <CardHeader>
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
              <CardTitle className="text-red-700">Upload Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">
                An unexpected error occurred during the upload process. This might be due to:
              </p>
              <ul className="mt-2 text-red-700 text-sm list-disc list-inside space-y-1">
                <li>Network connectivity issues</li>
                <li>File corruption or invalid format</li>
                <li>Server temporary unavailability</li>
                <li>Browser compatibility issues</li>
              </ul>
            </div>

            {this.state.error && (
              <details className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={this.handleRetry} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}