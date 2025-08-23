import { NextRequest, NextResponse } from 'next/server'
import { 
  emitJobProgress, 
  emitJobCompleted, 
  emitJobFailed, 
  emitLogMessage, 
  emitStageUpdate 
} from '@/lib/websocket-server'

export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json()

    switch (type) {
      case 'jobProgress':
        emitJobProgress(data.jobId, data.progress, data.stage, data.message)
        break
      
      case 'jobCompleted':
        emitJobCompleted(data.jobId, data.results)
        break
      
      case 'jobFailed':
        emitJobFailed(data.jobId, data.error)
        break
      
      case 'logMessage':
        emitLogMessage(data.jobId, data.level, data.message, data.timestamp ? new Date(data.timestamp) : new Date())
        break
      
      case 'stageUpdate':
        emitStageUpdate(data.jobId, data.stage, data.status, data.progress)
        break
      
      default:
        return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('WebSocket emit error:', error)
    return NextResponse.json(
      { error: 'Failed to emit WebSocket event' }, 
      { status: 500 }
    )
  }
}