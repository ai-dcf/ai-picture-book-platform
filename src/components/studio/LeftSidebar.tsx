"use client";
import { useState } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Loader2,
  XCircle,
  Menu,
} from 'lucide-react';
import {
  StageNumber,
  StageStatus,
  PageStatus,
  PAGE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  STAGE_LABELS,
} from '@/types/picturebook';

const STAGES: StageNumber[] = [1, 2, 3, 4, 5];

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

function SidebarContent() {
  const { state, dispatch } = useStudio();
  const { currentStage, stageStatuses, pages, projectInfo } = state;

  function handleStageClick(id: StageNumber) {
    if (stageStatuses[id] === 'idle') return;
    dispatch({ type: 'SET_STAGE', payload: id });
  }

  const finalizedCount = pages.filter(p => p.pageStatus === 'finalized').length;
  const reviewCount = pages.filter(p => p.pageStatus === 'review' || p.pageStatus === 'pending').length;
  const completedStages = STAGES.filter(s => stageStatuses[s] === 'done').length;

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {STAGES.map(s => {
            const status = stageStatuses[s];
            const isActive = currentStage === s;
            const isLocked = status === 'idle';
            return (
              <div key={s}>
                <button
                  onClick={() => handleStageClick(s)}
                  disabled={isLocked}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-body transition-smooth text-left',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : isLocked
                      ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                      : 'hover:bg-sidebar-accent text-sidebar-foreground'
                  )}
                >
                  <StageIcon status={status} />
                  <span className="flex-1 truncate">{STAGE_LABELS[s]}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                </button>

                {s === 4 && (currentStage === 4 || status === 'done') && (
                  <div className="ml-7 mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                    {pages.map(p => (
                      <button
                        key={p.index}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-body text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-smooth"
                      >
                        <PageStatusDot status={p.pageStatus} />
                        <span className="flex-1 text-left">第 {p.index + 1} 页</span>
                        <span className="text-[10px] opacity-60">{PAGE_STATUS_LABELS[p.pageStatus]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{PROJECT_STATUS_LABELS[projectInfo.projectStatus]}</span>
        </div>
        <div className="space-y-1 text-xs font-body">
          <div className="flex justify-between text-muted-foreground">
            <span>已完成阶段</span>
            <span className="font-medium text-foreground">{completedStages} / 5</span>
          </div>
          {currentStage >= 5 && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>已定稿</span>
                <span className="font-medium text-green-600">{finalizedCount} / {pages.length}</span>
              </div>
              {reviewCount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>待复查</span>
                  <span className="font-medium text-amber-600">{reviewCount}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LeftSidebar() {
  const { state, dispatch } = useStudio();
  const { currentStage, stageStatuses } = state;
  const [collapsed, setCollapsed] = useState(false);

  function handleStageClick(id: StageNumber) {
    if (stageStatuses[id] === 'idle') return;
    dispatch({ type: 'SET_STAGE', payload: id });
  }

  if (collapsed) {
    return (
      <aside className="w-12 flex flex-col items-center py-3 gap-3 border-r border-border bg-sidebar flex-shrink-0">
        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setCollapsed(false)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        {STAGES.map(s => (
          <button
            key={s}
            onClick={() => handleStageClick(s)}
            className={cn(
              'w-8 h-8 rounded-lg text-xs font-display flex items-center justify-center transition-smooth',
              currentStage === s
                ? 'gradient-hero text-primary-foreground shadow-glow'
                : stageStatuses[s] === 'idle'
                ? 'text-muted-foreground cursor-not-allowed opacity-40'
                : 'hover:bg-sidebar-accent text-sidebar-foreground'
            )}
          >
            {s}
          </button>
        ))}
      </aside>
    );
  }

  return (
    <>
      <aside className="hidden lg:flex w-56 flex-col border-r border-border bg-sidebar flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-3 border-b border-sidebar-border">
          <span className="text-xs font-body font-medium text-muted-foreground tracking-wide uppercase">创作进度</span>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setCollapsed(true)}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
        </div>
        <SidebarContent />
      </aside>

      <div className="lg:hidden fixed bottom-4 left-4 z-40">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" className="w-12 h-12 rounded-full shadow-elevated gradient-hero text-primary-foreground">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="px-3 py-3 border-b border-sidebar-border">
              <SheetTitle className="text-sm font-body font-medium text-muted-foreground uppercase tracking-wide">
                创作进度
              </SheetTitle>
            </SheetHeader>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
