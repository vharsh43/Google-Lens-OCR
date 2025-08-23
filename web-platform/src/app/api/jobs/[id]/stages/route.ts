import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;

    // Get job with stages
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        stages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        logs: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 100, // Limit to recent logs
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Transform stages to match the expected format
    const stages = job.stages.map(stage => ({
      id: stage.id,
      type: stage.stage,
      name: formatStageName(stage.stage),
      status: stage.status,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      progress: stage.progress,
      totalSteps: stage.totalSteps,
      currentStep: stage.currentStep,
      duration: stage.startedAt && stage.completedAt 
        ? Math.floor((stage.completedAt.getTime() - stage.startedAt.getTime()) / 1000)
        : null,
      details: stage.details,
      errorMessage: stage.errorMessage,
      logs: job.logs
        .filter(log => log.stage === stage.stage)
        .map(log => log.message)
        .slice(0, 20) // Limit logs per stage
    }));

    return NextResponse.json({
      stages,
      totalStages: stages.length,
      currentStage: stages.find(s => s.status === 'RUNNING')?.type || null,
    });

  } catch (error) {
    console.error('Get job stages error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch job stages' },
      { status: 500 }
    );
  }
}

function formatStageName(stageType: string): string {
  const stageNames: { [key: string]: string } = {
    'INITIALIZATION': 'Initialization',
    'FILE_VALIDATION': 'File Validation',
    'PDF_CONVERSION': 'PDF Conversion',
    'OCR_PROCESSING': 'OCR Processing',
    'TEXT_EXTRACTION': 'Text Extraction',
    'QUALITY_ANALYSIS': 'Quality Analysis',
    'FILE_ORGANIZATION': 'File Organization',
    'FINALIZATION': 'Finalization'
  };
  
  return stageNames[stageType] || stageType.replace(/_/g, ' ');
}