"use client";

import type { ReactNode } from 'react';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StageActionHeaderProps = {
  title: string;
  description?: string;
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
  description,
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
      'flex w-full flex-col gap-4 px-4 py-1 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-x-6 lg:gap-y-3 lg:px-2 lg:py-2 xl:grid-cols-[minmax(0,1fr)_460px]',
      className
    )}>
      <div className="min-w-0 lg:min-h-[72px] lg:max-w-3xl lg:pr-2">
        <h2 className="font-display text-2xl text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm font-body text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 lg:min-h-[72px] lg:w-full lg:items-end lg:justify-between">
        <div className="flex min-h-[32px] w-full flex-wrap items-center gap-2 lg:justify-end">
          {accessory}
        </div>

        <div className="flex min-h-[40px] w-full flex-wrap items-center gap-2 lg:justify-end">
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
    </div>
  );
}
