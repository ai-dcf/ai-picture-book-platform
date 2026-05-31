"use client";
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  StageNumber,
  StageStatus,
  PageStatus,
  STAGE_LABELS,
} from '@/types/picturebook';

const STAGES: StageNumber[] = [2, 3, 4, 5];

function StageIcon({ status }: { status: StageStatus }) {
  if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'in-progress') return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
  if (status === 'review') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  if (status === 'invalid') return <XCircle className="w-4 h-4 text-destructive" />;
  return <Circle className="w-4 h-4 text-muted-foreground" />;
}

function PageStatusDot({ status }: { status: PageStatus }) {
  const cls = {
    idle: 'bg-muted-foreground/30',
    pending: 'bg-amber-500',
    generating: 'bg-primary animate-pulse',
    generated: 'bg-green-500',
    review: 'bg-amber-500',
    finalized: 'bg-green-600',
  }[status];
  return <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cls)} />;
}

export default function ProjectProgress() {
  const { state, dispatch } = useStudio();
  const { currentStage, stageStatuses, pages } = state;

  function handleStageClick(id: StageNumber) {
    if (stageStatuses[id] === 'idle') return;
    dispatch({ type: 'SET_STAGE', payload: id });
  }

  return (
    <div className="w-full border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 py-3">
        
        <div className="flex items-center gap-1">
          {STAGES.map((s, index) => {
            const status = stageStatuses[s];
            const isActive = currentStage === s;
            const isLocked = status === 'idle';
            const isLast = index === STAGES.length - 1;
            
            return (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => handleStageClick(s)}
                  disabled={isLocked}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-body transition-smooth',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : isLocked
                      ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  <StageIcon status={status} />
                  <span className="whitespace-nowrap">{STAGE_LABELS[s]}</span>
                </button>

                {!isLast && (
                  <div className="w-8 h-px bg-border mx-1" />
                )}
              </div>
            );
          })}
        </div>

        {currentStage === 5 || stageStatuses[5] === 'done' ? (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-4">
              <span className="text-xs font-body text-muted-foreground">页面进度</span>
              <div className="flex items-center gap-1 flex-wrap">
                {pages.map(p => (
                  <div key={p.index} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-body bg-muted">
                    <PageStatusDot status={p.pageStatus} />
                    <span>第 {p.index + 1} 页</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
