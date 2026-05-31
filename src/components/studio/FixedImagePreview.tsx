import { cn } from '@/lib/utils';
import { Expand, ImageIcon, Wand2 } from 'lucide-react';
import React from 'react';

export interface FixedImagePreviewProps {
  imageUrl?: string | null;
  alt?: string;
  isGenerating?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  generatingTitle?: string;
  generatingDescription?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function FixedImagePreview({
  imageUrl,
  alt = 'Preview',
  isGenerating = false,
  emptyTitle = '还没有预览图',
  emptyDescription,
  generatingTitle = '正在生成插画',
  generatingDescription = '生成完成后会显示在这里',
  onClick,
  children,
  className,
}: FixedImagePreviewProps) {
  return (
    <div className={cn(
      'group relative w-full h-[380px] flex items-center justify-center overflow-hidden rounded-[2rem] border-2 p-4 transition-all',
      imageUrl && !isGenerating 
        ? 'border-border/50 bg-muted/20 hover:border-primary/30' 
        : 'border-dashed border-border/80 bg-muted/50',
      className
    )}>
      {children}

      {isGenerating && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/85 px-4 backdrop-blur-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-hero animate-pulse-soft shadow-sm">
            <Wand2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm font-body font-medium text-foreground">{generatingTitle}</p>
            {generatingDescription && (
              <p className="text-xs font-body text-muted-foreground">{generatingDescription}</p>
            )}
          </div>
        </div>
      )}

      {imageUrl && !isGenerating ? (
        <>
          <img
            src={imageUrl}
            alt={alt}
            onClick={onClick}
            className="max-h-full max-w-full cursor-pointer rounded-[1.5rem] object-contain transition-transform duration-300 group-hover:scale-[1.02] shadow-sm relative z-10"
          />
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/15 group-hover:opacity-100">
            <div className="rounded-full bg-black/55 p-3">
              <Expand className="h-5 w-5 text-white" />
            </div>
          </div>
        </>
      ) : !isGenerating ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background/80 shadow-sm">
            <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-body font-medium text-foreground">{emptyTitle}</p>
            {emptyDescription && (
              <p className="text-xs font-body leading-5 text-muted-foreground">
                {emptyDescription}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}