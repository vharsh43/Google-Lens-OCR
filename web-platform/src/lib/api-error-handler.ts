import React from 'react'

interface ApiError {
  message: string
  status?: number
  code?: string
  details?: any
}

export class ApiErrorHandler {
  static handle(error: any): ApiError {
    // Only log non-empty errors to avoid console spam
    if (error && (typeof error !== 'object' || Object.keys(error).length > 0)) {
      console.error('API Error:', error)
    }

    // Handle null/undefined errors
    if (!error) {
      return {
        message: 'An unknown error occurred.',
        code: 'NULL_ERROR'
      }
    }

    // Handle empty object errors
    if (typeof error === 'object' && Object.keys(error).length === 0) {
      return {
        message: 'An unexpected server error occurred.',
        code: 'EMPTY_ERROR'
      }
    }

    // Network errors
    if (error instanceof TypeError && error.message && error.message.includes('fetch')) {
      return {
        message: 'Network error. Please check your connection and try again.',
        status: 0,
        code: 'NETWORK_ERROR'
      }
    }

    // Response errors - handle synchronously with fallback
    if (error instanceof Response) {
      return {
        message: `Server error: ${error.status} ${error.statusText}`,
        status: error.status,
        code: 'RESPONSE_ERROR'
      }
    }

    // Standard errors
    if (error instanceof Error) {
      return {
        message: error.message || 'An error occurred',
        code: 'STANDARD_ERROR'
      }
    }

    // String errors
    if (typeof error === 'string') {
      return {
        message: error,
        code: 'STRING_ERROR'
      }
    }

    // Object with message property
    if (error && typeof error === 'object' && error.message) {
      return {
        message: error.message,
        status: error.status,
        code: error.code || 'OBJECT_ERROR'
      }
    }

    // Unknown errors
    return {
      message: `An unexpected error occurred: ${JSON.stringify(error)}`,
      code: 'UNKNOWN_ERROR'
    }
  }

  private static async handleResponseError(response: Response): Promise<ApiError> {
    const status = response.status
    let message = 'An error occurred'
    let details: any = null

    try {
      const data = await response.json()
      message = data.error || data.message || message
      details = data.details
    } catch {
      // If we can't parse JSON, use status text
      message = response.statusText || `HTTP ${status} error`
    }

    return {
      message: this.getFriendlyErrorMessage(status, message),
      status,
      code: `HTTP_${status}`,
      details
    }
  }

  private static getFriendlyErrorMessage(status: number, originalMessage: string): string {
    const friendlyMessages: Record<number, string> = {
      400: 'Invalid request. Please check your input and try again.',
      401: 'You are not authorized. Please log in and try again.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested resource was not found.',
      409: 'A conflict occurred. The resource may already exist.',
      413: 'The file is too large. Please try a smaller file.',
      422: 'The request could not be processed. Please check your input.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: 'An internal server error occurred. Please try again later.',
      502: 'The server is temporarily unavailable. Please try again later.',
      503: 'The service is temporarily unavailable. Please try again later.',
      504: 'The request timed out. Please try again.'
    }

    return friendlyMessages[status] || originalMessage
  }

  static async safeFetch(
    url: string, 
    options: RequestInit = {},
    timeout = 30000
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // Don't set Content-Type for FormData - let browser handle it
      const headers: Record<string, string> = {}
      
      // Only set JSON content type if body is not FormData
      if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json'
      }
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...headers,
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw response
      }

      return response
    } catch (error) {
      clearTimeout(timeoutId)
      
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.')
      }
      
      throw error
    }
  }

  static async safeApiCall<T>(
    apiCall: () => Promise<T>,
    fallbackValue?: T
  ): Promise<{ data: T | null; error: ApiError | null }> {
    try {
      const data = await apiCall()
      return { data, error: null }
    } catch (error) {
      const apiError = this.handle(error)
      return { 
        data: fallbackValue || null, 
        error: apiError 
      }
    }
  }
}

// Retry logic for failed requests
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Don't retry for certain error types
      if (error instanceof Response) {
        const status = error.status
        if (status >= 400 && status < 500 && status !== 429) {
          // Client errors (except rate limiting) shouldn't be retried
          throw error
        }
      }

      if (attempt === maxRetries) {
        break
      }

      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  throw lastError
}

// React hook for API calls with error handling
export function useApiCall<T>() {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<ApiError | null>(null)

  const execute = async (apiCall: () => Promise<T>) => {
    setLoading(true)
    setError(null)

    const { data: result, error: apiError } = await ApiErrorHandler.safeApiCall(apiCall)
    
    setData(result)
    setError(apiError)
    setLoading(false)

    return { data: result, error: apiError }
  }

  const reset = () => {
    setData(null)
    setError(null)
    setLoading(false)
  }

  return {
    data,
    loading,
    error,
    execute,
    reset
  }
}

// Validation helpers
export const validateFile = (file: File): string[] => {
  const errors: string[] = []
  
  if (!file) {
    errors.push('No file provided')
    return errors
  }

  // Ensure file has required properties
  if (!file.name || typeof file.name !== 'string') {
    errors.push('File has no name or invalid name')
    return errors
  }

  if (typeof file.size !== 'number') {
    errors.push('File has invalid size')
    return errors
  }

  // Check for PDF by MIME type and file extension
  const fileType = file.type || ''
  const fileName = file.name
  
  const isPdfMimeType = [
    'application/pdf',
    'application/x-pdf',
    'application/acrobat',
    'applications/vnd.pdf',
    'text/pdf',
    'text/x-pdf'
  ].includes(fileType)
  
  const isPdfExtension = fileName.toLowerCase().endsWith('.pdf')
  
  if (!isPdfMimeType && !isPdfExtension) {
    errors.push(`File "${fileName}" is not a PDF. Only PDF files are supported.`)
  } else if (!isPdfMimeType && isPdfExtension) {
    // File has .pdf extension but wrong MIME type - likely browser issue, warn but allow
    console.warn(`File "${fileName}" has .pdf extension but MIME type "${fileType}". Allowing upload.`)
  }

  // Only warn about very large files (>1GB) but don't block them
  const warningSize = 1024 * 1024 * 1024 // 1GB
  if (file.size > warningSize) {
    // This is just a warning, not an error
    console.warn(`Large file detected: ${fileName} (${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB). Processing may take longer.`)
  }

  if (file.size === 0) {
    errors.push('File is empty')
  }

  return errors
}

export const validateJobName = (name: string): string[] => {
  const errors: string[] = []
  
  // Job name is now optional - only validate if provided
  if (name && name.trim().length > 0) {
    if (name.length > 100) {
      errors.push('Job name must be less than 100 characters')
    }
    
    // Check for invalid characters
    if (!/^[a-zA-Z0-9\s\-_.,():/]+$/.test(name)) {
      errors.push('Job name contains invalid characters')
    }
  }

  return errors
}