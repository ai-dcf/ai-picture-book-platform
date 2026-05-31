"use client";

import type { ReactNode } from 'react';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StageActionHeaderProps = {
  title: string;
  onRegenerate: () => void;
  onNext: () => void;
  regenerateDisabled?: boolean;
  nextDisabled?: boolean;
  regenerating?: boolean;
  proceeding?: boolean;
  accessory?: ReactNode;
  extraActions?: ReactNode;
  className?: string;
};

export default function StageActionHeader({
  title,
  onRegenerate,
  onNext,
  regenerateDisabled = false,
  nextDisabled = false,
  regenerating = false,
  proceeding = false,
  accessory,
  extraActions,
  className,
}: StageActionHeaderProps) {
  return (
    <div className={cn(
      'flex w-full items-center justify-between px-4 py-2 lg:px-2',
      className
    )}>
      <div className="flex items-center gap-4 min-w-0">
        <h2 className="font-display text-2xl text-foreground whitespace-nowrap">{title}</h2>
        {accessory}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onRegenerate}
          disabled={regenerateDisabled || regenerating}
          className="h-10 gap-2 whitespace-nowrap font-body"
        >
          {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {regenerating ? '重新生成中…' : '重新生成'}
        </Button>

        {extraActions}

        <Button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || proceeding}
          className="h-10 gap-2 whitespace-nowrap border-0 font-body gradient-hero text-primary-foreground"
        >
          {proceeding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          下一步
          {!proceeding ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>
      </div>
    </div>
  );
}
