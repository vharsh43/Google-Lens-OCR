'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  FileText, 
  Upload, 
  BarChart3,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

export function WelcomeSection() {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="p-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 rounded-full mr-3">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome to OCR Platform
                </h1>
                <p className="text-gray-600">
                  Transform your PDFs into searchable text with advanced OCR technology
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Link href="/upload">
                <div className="group p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center mb-2">
                    <Upload className="h-5 w-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-gray-900">Upload Files</h3>
                    <ArrowRight className="h-4 w-4 text-gray-400 ml-auto group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-sm text-gray-600">
                    Upload PDF files for OCR processing
                  </p>
                </div>
              </Link>
              
              <Link href="/jobs">
                <div className="group p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center mb-2">
                    <FileText className="h-5 w-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-gray-900">Manage Jobs</h3>
                    <ArrowRight className="h-4 w-4 text-gray-400 ml-auto group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-sm text-gray-600">
                    View and manage your OCR jobs
                  </p>
                </div>
              </Link>
              
              <Link href="/analytics">
                <div className="group p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center mb-2">
                    <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-gray-900">View Analytics</h3>
                    <ArrowRight className="h-4 w-4 text-gray-400 ml-auto group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-sm text-gray-600">
                    Analyze processing metrics
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}