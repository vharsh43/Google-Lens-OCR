'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  title: string
  description: string
  confirmationText?: string
  confirmButtonText?: string
  isDestructive?: boolean
  isLoading?: boolean
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmationText = 'DELETE',
  confirmButtonText = 'Delete',
  isDestructive = true,
  isLoading = false
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState('')
  const isConfirmEnabled = inputValue === confirmationText && !isLoading

  const handleConfirm = async () => {
    if (isConfirmEnabled) {
      await onConfirm()
      setInputValue('')
    }
  }

  const handleClose = () => {
    setInputValue('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            <div className={`p-2 rounded-lg ${isDestructive ? 'bg-red-100' : 'bg-yellow-100'}`}>
              {isDestructive ? (
                <Trash2 className={`h-5 w-5 ${isDestructive ? 'text-red-600' : 'text-yellow-600'}`} />
              ) : (
                <AlertTriangle className={`h-5 w-5 ${isDestructive ? 'text-red-600' : 'text-yellow-600'}`} />
              )}
            </div>
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`p-4 rounded-lg border-l-4 ${
            isDestructive 
              ? 'bg-red-50 border-red-400' 
              : 'bg-yellow-50 border-yellow-400'
          }`}>
            <div className="flex items-center space-x-2">
              <AlertTriangle className={`h-4 w-4 ${
                isDestructive ? 'text-red-600' : 'text-yellow-600'
              }`} />
              <p className={`text-sm font-medium ${
                isDestructive ? 'text-red-800' : 'text-yellow-800'
              }`}>
                This action cannot be undone!
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmation-input" className="text-sm font-medium text-gray-700">
              Type <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">{confirmationText}</code> to confirm:
            </label>
            <Input
              id="confirmation-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Type "${confirmationText}" here`}
              disabled={isLoading}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmButtonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}