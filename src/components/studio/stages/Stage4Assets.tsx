"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useStudioGenerate } from '@/modules/studio/presentation/hooks/use-studio-generate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import StageActionHeader from '@/components/studio/StageActionHeader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { buildUserFriendlyAssetPrompt } from '@/prompts';
import { cn } from '@/lib/utils';
import {
  AssetItem,
  ASPECT_RATIOS,
  ASSET_STATUS_LABELS,
  AspectRatio,
  BaseImageHistoryEntry,
  CandidateHistoryEntry,
} from '@/types/picturebook';
import {
  Check,
  ChevronDown,
  History,
  ImageIcon,
  Loader2,
  MapPin,
  Star,
  Users,
  Wand2,
} from 'lucide-react';

type PreviewPayload = {
  imageUrl: string;
  alt: string;
};

function getAspectClass(ratio: AspectRatio) {
  const map: Record<AspectRatio, string> = {
    '3:4': 'aspect-[3/4]',
    '9:16': 'aspect-[9/16]',
    '16:9': 'aspect-[16/9]',
    '1:1': 'aspect-square',
  };
  return map[ratio];
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function ImagePreviewDialog({
  open,
  onOpenChange,
  imageUrl,
  alt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  alt: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-auto p-0 border-0 bg-transparent shadow-none">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-md"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AssetStatusBadge({ asset }: { asset: AssetItem }) {
  return (
    <span className={cn(
      'text-[10px] px-2 py-0.5 rounded-full font-body font-bold',
      asset.status === 'official_confirmed' && 'bg-green-100 text-green-700',
      asset.status === 'candidates_generated' && 'bg-blue-100 text-blue-700',
      asset.status === 'not_generated' && 'bg-muted text-muted-foreground',
      (asset.status === 'pending_update' || asset.status === 'review') && 'bg-amber-100 text-amber-700',
    )}>
      {ASSET_STATUS_LABELS[asset.status]}
    </span>
  );
}

function AssetPromptEditor({
  asset,
  assetType,
  onGeneratePrompt,
  isPromptGenerating = false,
}: {
  asset: AssetItem;
  assetType: 'characters' | 'scenes';
  onGeneratePrompt?: () => Promise<void>;
  isPromptGenerating?: boolean;
}) {
  const { state, dispatch, triggerSave } = useStudio();
  const promptActionDisabled = asset.generating || isPromptGenerating;

  function handleDescChange(description: string) {
    dispatch({ type: 'UPDATE_ASSET_DESCRIPTION', payload: { type: assetType, id: asset.id, description } });
    triggerSave();
  }

  function handlePromptChange(prompt: string) {
    dispatch({ type: 'UPDATE_ASSET_PROMPT', payload: { type: assetType, id: asset.id, prompt } });
    triggerSave();
  }

  async function handleResetPrompt() {
    if (assetType === 'characters' && onGeneratePrompt) {
      await onGeneratePrompt();
      return;
    }
    dispatch({
      type: 'UPDATE_ASSET_PROMPT',
      payload: {
        type: assetType,
        id: asset.id,
        prompt: buildUserFriendlyAssetPrompt({
          kind: assetType === 'characters' ? 'character' : 'scene',
          name: asset.name,
          description: asset.description,
          projectInfo: { ...state.projectInfo, aspectRatio: asset.aspectRatio },
        }),
        userEdited: false,
      },
    });
    triggerSave();
  }

  return (
    <>
      <div className="space-y-2 mb-4">
        <p className="text-xs font-body font-bold text-muted-foreground">形象描述</p>
        <Textarea
          value={asset.description}
          onChange={e => handleDescChange(e.target.value)}
          placeholder={assetType === 'characters' ? '描述角色外观、服饰、气质与关键特征…' : '描述场景氛围、空间元素与时代背景…'}
          className="ink-textarea text-xs min-h-[64px]"
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-body font-bold text-muted-foreground">AI绘画提示词</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
            <button
              type="button"
              onClick={handleResetPrompt}
              disabled={promptActionDisabled}
              className="text-[11px] text-primary font-body font-bold hover:underline"
            >
              {isPromptGenerating ? '重新生成中…' : '重新生成提示词'}
            </button>
          </div>
        </div>
        <Textarea
          value={asset.prompt || ''}
          onChange={e => handlePromptChange(e.target.value)}
          placeholder="系统会自动生成素材提示词，你也可以继续编辑…"
          className="ink-textarea text-xs min-h-[120px]"
        />
      </div>
    </>
  );
}

function LoadingTiles({ count = 3, aspectRatio = '1:1' }: { count?: number; aspectRatio?: AspectRatio }) {
  return (
    <div className={cn('grid gap-3', count === 1 ? 'grid-cols-1' : 'grid-cols-3')}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'rounded-[2rem] bg-muted/50 overflow-hidden relative border-2 border-dashed border-border',
            getAspectClass(aspectRatio),
          )}
          style={{ animationDelay: `${index * 0.15}s` }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyPreview({
  label,
  aspectRatio = '1:1',
  className,
}: {
  label: string;
  aspectRatio?: AspectRatio;
  className?: string;
}) {
  return (
    <div className={cn(
      'rounded-[2rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-muted/30',
      getAspectClass(aspectRatio),
      className,
    )}>
      <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
      <span className="text-sm font-body text-muted-foreground">{label}</span>
    </div>
  );
}

function useLazyImage() {
  const ref = useRef<HTMLButtonElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

function HistoryImageThumbnail({
  imageUrl,
  timestamp,
  isSelected,
  aspectRatio,
  onClick,
}: {
  imageUrl: string;
  timestamp: number;
  isSelected: boolean;
  aspectRatio: AspectRatio;
  onClick: () => void;
}) {
  const { ref, isVisible } = useLazyImage();

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'rounded-2xl overflow-hidden relative border-2 transition-all group',
        isSelected
          ? 'border-primary shadow-ink-light'
          : 'border-transparent hover:border-primary/40',
      )}
      onClick={onClick}
    >
      <div className={cn(getAspectClass(aspectRatio), 'w-full bg-muted/50')}>
        {isVisible ? (
          <img
            src={imageUrl}
            alt={`历史版本 ${formatTimestamp(timestamp)}`}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
          </div>
        )}
      </div>
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
          <Check className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
      <p className="text-[10px] text-center font-body font-bold text-muted-foreground mt-1">
        {formatTimestamp(timestamp)}
      </p>
    </button>
  );
}

function SwitchBaseImageDialog({
  open,
  onOpenChange,
  imageUrl,
  timestamp,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  timestamp: number;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="card-ink rounded-[2rem] border-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-body text-xl font-bold">切换基础形象</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <div className="rounded-[2rem] overflow-hidden border-2 border-border/50 bg-muted/50 max-w-[240px] mx-auto">
                <img
                  src={imageUrl}
                  alt="待切换的基础形象"
                  className="w-full object-cover"
                />
              </div>
              <p className="text-sm font-body text-foreground">
                切换后，当前已确认的基础形象将被替换。确定切换？
              </p>
              <p className="text-xs font-body text-muted-foreground">
                生成时间：{formatTimestamp(timestamp)}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-body rounded-xl border-2">取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="font-body btn-ink rounded-xl border-0">确认切换</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SwitchCandidateDialog({
  open,
  onOpenChange,
  candidates,
  timestamp,
  roundIndex,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: string[];
  timestamp: number;
  roundIndex: number;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="card-ink rounded-[2rem] border-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-body text-xl font-bold">切换候选图</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3">
                {candidates.map((url, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden border-2 border-border/50 bg-muted/50">
                    <img
                      src={url}
                      alt={`候选图 ${i + 1}`}
                      className="w-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm font-body text-foreground">
                切换后，当前已选的正式版本将被重置。确定切换？
              </p>
              <p className="text-xs font-body text-muted-foreground">
                第 {roundIndex + 1} 轮 · {formatTimestamp(timestamp)}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-body rounded-xl border-2">取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="font-body btn-ink rounded-xl border-0">确认切换</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BaseImageHistoryPanel({
  asset,
  assetType,
  onPreview,
}: {
  asset: AssetItem;
  assetType: 'characters' | 'scenes';
  onPreview: (payload: PreviewPayload) => void;
}) {
  const { dispatch, triggerSave } = useStudio();
  const [open, setOpen] = useState(false);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    entry: BaseImageHistoryEntry | null;
    index: number;
  }>({ open: false, entry: null, index: -1 });

  const history = asset.baseImageHistory;
  if (history.length === 0) return null;

  function handleSelect(historyIndex: number) {
    const entry = history[historyIndex];
    if (!entry) return;
    setDialogState({ open: true, entry, index: historyIndex });
  }

  function handleConfirm() {
    if (dialogState.index < 0) return;
    dispatch({
      type: 'SELECT_BASE_IMAGE_FROM_HISTORY',
      payload: { type: assetType, id: asset.id, historyIndex: dialogState.index },
    });
    triggerSave();
    setDialogState({ open: false, entry: null, index: -1 });
  }

  return (
    <div className="mt-4">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-body font-bold text-muted-foreground hover:text-foreground transition-colors w-full py-2 px-3 rounded-xl hover:bg-muted/50"
          >
            <History className="w-4 h-4" />
            历史版本 ({history.length})
            <ChevronDown className={cn('w-4 h-4 transition-transform ml-auto', open && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 pt-3 px-1">
            {history.map((entry, index) => {
              const isOfficial = asset.officialImageUrl === entry.imageUrl;
              return (
                <HistoryImageThumbnail
                  key={entry.timestamp}
                  imageUrl={entry.imageUrl}
                  timestamp={entry.timestamp}
                  isSelected={isOfficial}
                  aspectRatio={asset.aspectRatio}
                  onClick={() => handleSelect(index)}
                />
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {dialogState.entry && (
        <SwitchBaseImageDialog
          open={dialogState.open}
          onOpenChange={(o) => setDialogState(prev => ({ ...prev, open: o }))}
          imageUrl={dialogState.entry.imageUrl}
          timestamp={dialogState.entry.timestamp}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

function CandidateHistoryPanel({
  asset,
  onPreview,
}: {
  asset: AssetItem;
  onPreview: (payload: PreviewPayload) => void;
}) {
  const { dispatch, triggerSave } = useStudio();
  const [open, setOpen] = useState(false);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    entry: CandidateHistoryEntry | null;
    index: number;
  }>({ open: false, entry: null, index: -1 });

  const history = asset.candidateHistory;
  if (history.length === 0) return null;

  function handleSelect(historyIndex: number) {
    const entry = history[historyIndex];
    if (!entry) return;
    setDialogState({ open: true, entry, index: historyIndex });
  }

  function handleConfirm() {
    if (dialogState.index < 0) return;
    dispatch({
      type: 'SELECT_CANDIDATE_FROM_HISTORY',
      payload: { id: asset.id, historyIndex: dialogState.index },
    });
    triggerSave();
    setDialogState({ open: false, entry: null, index: -1 });
  }

  return (
    <div className="mt-4">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-body font-bold text-muted-foreground hover:text-foreground transition-colors w-full py-2 px-3 rounded-xl hover:bg-muted/50"
          >
            <History className="w-4 h-4" />
            候选图历史 ({history.length})
            <ChevronDown className={cn('w-4 h-4 transition-transform ml-auto', open && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 pt-3 px-1">
            {history.map((entry, index) => {
              const isOfficial = asset.officialImageUrl && entry.candidates.includes(asset.officialImageUrl);
              return (
                <div
                  key={entry.timestamp}
                  className={cn(
                    'rounded-2xl border-2 p-3 transition-all cursor-pointer bg-background/50',
                    isOfficial
                      ? 'border-primary shadow-ink-light'
                      : 'border-border/50 hover:border-primary/40 hover:bg-primary/5',
                  )}
                  onClick={() => handleSelect(index)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-body font-bold text-muted-foreground">
                      第 {history.length - index} 轮 · {formatTimestamp(entry.timestamp)}
                    </span>
                    {isOfficial && (
                      <span className="flex items-center gap-1.5 text-[11px] font-body font-bold text-primary">
                        <Check className="w-3.5 h-3.5" />
                        已确认
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {entry.candidates.map((url, i) => (
                      <div key={i} className="rounded-xl overflow-hidden border border-border/50 bg-muted/50">
                        <img
                          src={url}
                          alt={`第 ${history.length - index} 轮候选图 ${i + 1}`}
                          loading="lazy"
                          className="w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {dialogState.entry && (
        <SwitchCandidateDialog
          open={dialogState.open}
          onOpenChange={(o) => setDialogState(prev => ({ ...prev, open: o }))}
          candidates={dialogState.entry.candidates}
          timestamp={dialogState.entry.timestamp}
          roundIndex={dialogState.index}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

function WorkbenchListPanel({
  title,
  description,
  items,
  selectedId,
  onSelect,
  actions,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; name: string; status: AssetItem['status'] }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] card-ink shadow-ink-light relative overflow-hidden flex flex-col min-h-0 h-full">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 to-transparent pointer-events-none" />
      <div className="border-b-2 border-border/50 px-6 py-5 relative z-10 shrink-0">
        <p className="text-xs font-body font-bold uppercase tracking-[0.2em] text-foreground">
          {title}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">{description}</p>
        {actions ? <div className="mt-4">{actions}</div> : null}
      </div>

      <ScrollArea className="max-h-[400px] xl:max-h-none xl:flex-1 relative z-10 min-h-0">
        <div className="space-y-2 p-4">
          {items.map(item => {
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  'w-full rounded-[1.5rem] border-2 px-4 py-3.5 text-left transition-smooth group',
                  isSelected
                    ? 'border-primary/50 bg-primary/5 shadow-sm'
                    : 'border-transparent bg-background/50 hover:border-primary/20 hover:bg-primary/5'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('text-sm font-body font-bold', isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary/80')}>
                    {item.name}
                  </span>
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full shadow-sm',
                      item.status === 'official_confirmed' && 'bg-green-500',
                      item.status === 'candidates_generated' && 'bg-blue-500',
                      item.status === 'not_generated' && 'bg-muted-foreground/30',
                      (item.status === 'pending_update' || item.status === 'review') && 'bg-amber-500'
                    )}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function WorkbenchHistoryCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] card-ink shadow-ink-light relative overflow-hidden shrink-0">
      <div className="border-b-2 border-border/50 px-6 py-5 relative z-10">
        <h4 className="font-body font-bold text-base text-foreground">{title}</h4>
        <p className="mt-1 text-xs font-body text-muted-foreground">{description}</p>
      </div>
      <div className="px-6 py-5 relative z-10">{children}</div>
    </div>
  );
}

function CharacterWorkbenchDetail({
  asset,
  onPreview,
}: {
  asset: AssetItem;
  onPreview: (payload: PreviewPayload) => void;
}) {
  const { state, dispatch, triggerSave } = useStudio();
  const { generateAssetImage, generateCharacterPrompt } = useStudioGenerate();
  const baseConfirmed = Boolean(asset.officialImageUrl && asset.baseImageUrl && asset.officialImageUrl === asset.baseImageUrl);

  async function generatePromptFromModel() {
    dispatch({
      type: 'SET_ASSET_GENERATING',
      payload: { type: 'characters', id: asset.id, generating: true, phase: 'character_prompt' },
    });
    const prompt = await generateCharacterPrompt(
      asset,
      { ...state.projectInfo, aspectRatio: asset.aspectRatio }
    );
    if (!prompt) {
      dispatch({
        type: 'SET_ASSET_GENERATING',
        payload: { type: 'characters', id: asset.id, generating: false, phase: null },
      });
      return null;
    }
    dispatch({
      type: 'UPDATE_ASSET_PROMPT',
      payload: {
        type: 'characters',
        id: asset.id,
        prompt,
        userEdited: false,
      },
    });
    dispatch({
      type: 'SET_ASSET_GENERATING',
      payload: { type: 'characters', id: asset.id, generating: false, phase: null },
    });
    triggerSave();
    return prompt;
  }

  async function handleGenerateBase() {
    let prompt = (asset.prompt || '').trim();
    if (!prompt) {
      prompt = (await generatePromptFromModel()) || '';
      if (!prompt) return;
    }

    dispatch({
      type: 'SET_ASSET_GENERATING',
      payload: { type: 'characters', id: asset.id, generating: true, phase: 'character_base' },
    });
    const imageUrl = await generateAssetImage(
      {
        ...asset,
        prompt,
      },
      state.projectInfo
    );
    if (!imageUrl) {
      dispatch({
        type: 'SET_ASSET_GENERATING',
        payload: { type: 'characters', id: asset.id, generating: false, phase: null },
      });
      return;
    }
    dispatch({ type: 'SET_CHARACTER_BASE_IMAGE', payload: { id: asset.id, imageUrl } });
    triggerSave();
  }

  function handleConfirmBase() {
    dispatch({ type: 'CONFIRM_CHARACTER_BASE', payload: { id: asset.id } });
    triggerSave();
  }

  function handleAspectRatioChange(nextAspectRatio: string) {
    dispatch({
      type: 'UPDATE_ASSET_ASPECT_RATIO',
      payload: { type: 'characters', id: asset.id, aspectRatio: nextAspectRatio as AspectRatio },
    });
    triggerSave();
  }

  return (
    <>
      <div className="flex flex-col min-w-0 min-h-0 h-full rounded-[2rem] card-ink shadow-ink-light relative z-10 overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center -rotate-3">
                  <span className="font-display text-white text-xs">编</span>
                </div>
                <p className="text-sm font-body font-bold text-foreground">
                  编辑面板
                </p>
              </div>
              <AssetStatusBadge asset={asset} />
            </div>

            {asset.status === 'review' && (
              <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-body text-amber-700">
                画面比例已变更，建议重新生成当前角色参考图。
              </p>
            )}

            <AssetPromptEditor
              asset={asset}
              assetType="characters"
              onGeneratePrompt={async () => { await generatePromptFromModel(); }}
              isPromptGenerating={asset.generatingPhase === 'character_prompt'}
            />
          </div>
        </ScrollArea>
      </div>

      <div className="flex w-full flex-col gap-4 min-h-0 h-full">
        <ScrollArea className="flex-1 min-h-0 pr-3 -mr-3">
          <div className="flex flex-col gap-4 pb-2">
            <div className="min-w-0 rounded-[2rem] card-ink p-6 shadow-ink-light relative z-10 shrink-0">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center rotate-3">
                      <span className="font-display text-white text-xs">览</span>
                    </div>
                    <p className="text-sm font-body font-bold text-foreground">
                      预览面板
                    </p>
                  </div>
                  <p className="text-xs font-body text-muted-foreground">优先查看生成结果，再执行确认操作。</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Select value={asset.aspectRatio} onValueChange={handleAspectRatioChange}>
                    <SelectTrigger className="ink-input h-8 w-[100px] text-xs py-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="font-body">
                      {ASPECT_RATIOS.map(ratio => (
                        <SelectItem key={ratio} value={ratio} className="text-xs">
                          {ratio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {baseConfirmed && (
                    <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-body font-bold text-green-700">
                      <Check className="h-3 w-3" />
                      已确认
                    </div>
                  )}
                </div>
              </div>

              {asset.generating && asset.generatingPhase === 'character_base' ? (
                <div className="flex h-[380px] items-center justify-center rounded-[2rem] border-2 border-dashed border-border/50 bg-muted/20 p-4">
                  <div className="w-full max-w-[280px]">
                    <LoadingTiles count={1} aspectRatio={asset.aspectRatio} />
                  </div>
                </div>
              ) : asset.baseImageUrl ? (
                <button
                  type="button"
                  className="group flex h-[380px] w-full items-center justify-center overflow-hidden rounded-[2rem] border-2 border-border/50 bg-muted/20 p-4 transition-all hover:border-primary/30"
                  onClick={() => onPreview({ imageUrl: asset.baseImageUrl!, alt: `${asset.name} 基础形象` })}
                >
                  <img
                    src={asset.baseImageUrl}
                    alt={`${asset.name} 基础形象`}
                    className="max-h-full max-w-full rounded-[1.5rem] object-contain transition-transform group-hover:scale-[1.02] shadow-sm"
                  />
                </button>
              ) : (
                <EmptyPreview label="暂无基础形象图" aspectRatio={asset.aspectRatio} className="h-[380px]" />
              )}

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  onClick={handleGenerateBase}
                  disabled={asset.generating}
                  className="gap-2 font-body btn-ink rounded-xl border-0 h-11"
                >
                  {asset.generating && asset.generatingPhase === 'character_base'
                    ? <><Loader2 className="w-4 h-4 animate-spin" />生成中…</>
                    : <><Wand2 className="w-4 h-4" />{asset.baseImageUrl ? '重新生成' : '生成基础形象'}</>}
                </Button>
                <Button
                  onClick={handleConfirmBase}
                  disabled={!asset.baseImageUrl || asset.generating}
                  variant="outline"
                  className="gap-2 font-body rounded-xl border-2 h-11 hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                >
                  <Check className="w-4 h-4" />
                  确认基础形象
                </Button>
              </div>
            </div>

            <WorkbenchHistoryCard
              title="历史记录"
              description={`查看并切换 ${asset.name} 的基础形象历史版本。`}
            >
              <BaseImageHistoryPanel
                asset={asset}
                assetType="characters"
                onPreview={onPreview}
              />
            </WorkbenchHistoryCard>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function SceneWorkbenchDetail({
  asset,
  onPreview,
}: {
  asset: AssetItem;
  onPreview: (payload: PreviewPayload) => void;
}) {
  const { state, dispatch, triggerSave } = useStudio();
  const { generateAssetImage, generateScenePrompt } = useStudioGenerate();
  const [previewCandidateIndex, setPreviewCandidateIndex] = useState<number | null>(asset.officialIndex ?? (asset.candidates.length > 0 ? 0 : null));

  useEffect(() => {
    setPreviewCandidateIndex(asset.officialIndex ?? (asset.candidates.length > 0 ? 0 : null));
  }, [asset.id, asset.officialIndex, asset.candidates.length]);

  async function generatePromptFromModel() {
    dispatch({
      type: 'SET_ASSET_GENERATING',
      payload: { type: 'scenes', id: asset.id, generating: true, phase: 'scene_prompt' },
    });
    const prompt = await generateScenePrompt(
      asset,
      { ...state.projectInfo, aspectRatio: asset.aspectRatio }
    );
    if (!prompt) {
      dispatch({
        type: 'SET_ASSET_GENERATING',
        payload: { type: 'scenes', id: asset.id, generating: false, phase: null },
      });
      return null;
    }
    dispatch({
      type: 'UPDATE_ASSET_PROMPT',
      payload: {
        type: 'scenes',
        id: asset.id,
        prompt,
        userEdited: false,
      },
    });
    dispatch({
      type: 'SET_ASSET_GENERATING',
      payload: { type: 'scenes', id: asset.id, generating: false, phase: null },
    });
    triggerSave();
    return prompt;
  }

  async function handleGenerateCandidates() {
    let basePrompt = (asset.prompt || '').trim();
    if (!basePrompt) {
      basePrompt = (await generatePromptFromModel()) || '';
      if (!basePrompt) return;
    }

    const candidatePrompts = [
      `${basePrompt}\n\n候选图版本 A：在保持主体一致前提下，突出空间结构与构图层次。`,
      `${basePrompt}\n\n候选图版本 B：在保持主体一致前提下，突出光影氛围与色彩情绪。`,
      `${basePrompt}\n\n候选图版本 C：在保持主体一致前提下，突出镜头景别与叙事张力。`,
    ];

    dispatch({
      type: 'SET_ASSET_GENERATING',
      payload: { type: 'scenes', id: asset.id, generating: true, phase: 'scene_candidates' },
    });

    const images: string[] = [];
    for (const prompt of candidatePrompts) {
      const imageUrl = await generateAssetImage(
        {
          ...asset,
          prompt,
        },
        state.projectInfo
      );
      if (!imageUrl) {
        dispatch({
          type: 'SET_ASSET_GENERATING',
          payload: { type: 'scenes', id: asset.id, generating: false, phase: null },
        });
        return;
      }
      images.push(imageUrl);
    }

    dispatch({ type: 'SET_SCENE_CANDIDATES', payload: { id: asset.id, candidates: images } });
    triggerSave();
  }

  function handleSetOfficial(index: number) {
    dispatch({ type: 'SET_SCENE_OFFICIAL', payload: { id: asset.id, index } });
    triggerSave();
  }

  function handleAspectRatioChange(nextAspectRatio: string) {
    dispatch({
      type: 'UPDATE_ASSET_ASPECT_RATIO',
      payload: { type: 'scenes', id: asset.id, aspectRatio: nextAspectRatio as AspectRatio },
    });
    triggerSave();
  }

  const fallbackIndex = asset.officialIndex ?? previewCandidateIndex ?? 0;
  const previewUrl = asset.officialImageUrl || asset.candidates[fallbackIndex] || '';

  return (
    <>
      <div className="flex flex-col min-w-0 min-h-0 h-full rounded-[2rem] card-ink shadow-ink-light relative z-10 overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center -rotate-3">
                  <span className="font-display text-white text-xs">编</span>
                </div>
                <p className="text-sm font-body font-bold text-foreground">
                  编辑面板
                </p>
              </div>
              <AssetStatusBadge asset={asset} />
            </div>

            {asset.status === 'review' && (
              <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-body text-amber-700">
                画面比例已变更，建议重新生成当前场景候选图。
              </p>
            )}

            <AssetPromptEditor
              asset={asset}
              assetType="scenes"
              onGeneratePrompt={async () => { await generatePromptFromModel(); }}
              isPromptGenerating={asset.generatingPhase === 'scene_prompt'}
            />
          </div>
        </ScrollArea>
      </div>

      <div className="flex w-full flex-col gap-4 min-h-0 h-full">
        <ScrollArea className="flex-1 min-h-0 pr-3 -mr-3">
          <div className="flex flex-col gap-4 pb-2">
            <div className="min-w-0 rounded-[2rem] card-ink p-6 shadow-ink-light relative z-10 shrink-0">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center rotate-3">
                      <span className="font-display text-white text-xs">览</span>
                    </div>
                    <p className="text-sm font-body font-bold text-foreground">
                      预览面板
                    </p>
                  </div>
                  <p className="text-xs font-body text-muted-foreground">优先查看候选图，再设定当前正式版本。</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Select value={asset.aspectRatio} onValueChange={handleAspectRatioChange}>
                    <SelectTrigger className="ink-input h-8 w-[100px] text-xs py-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="font-body">
                      {ASPECT_RATIOS.map(ratio => (
                        <SelectItem key={ratio} value={ratio} className="text-xs">
                          {ratio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AssetStatusBadge asset={asset} />
                </div>
              </div>

              {asset.generating && asset.generatingPhase === 'scene_candidates' ? (
                <div className="flex h-[380px] items-center justify-center rounded-[2rem] border-2 border-dashed border-border/50 bg-muted/20 p-4">
                  <div className="w-full max-w-[280px]">
                    <LoadingTiles count={1} aspectRatio={asset.aspectRatio} />
                  </div>
                </div>
              ) : previewUrl ? (
                <button
                  type="button"
                  className="group flex h-[380px] w-full items-center justify-center overflow-hidden rounded-[2rem] border-2 border-border/50 bg-muted/20 p-4 transition-all hover:border-primary/30"
                  onClick={() => onPreview({ imageUrl: previewUrl, alt: `${asset.name} 场景预览` })}
                >
                  <img
                    src={previewUrl}
                    alt={`${asset.name} 场景预览`}
                    className="max-h-full max-w-full rounded-[1.5rem] object-contain transition-transform group-hover:scale-[1.02] shadow-sm"
                  />
                </button>
              ) : (
                <EmptyPreview label="暂无场景候选图" aspectRatio={asset.aspectRatio} className="h-[380px]" />
              )}

              {asset.candidates.length > 0 && (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {asset.candidates.map((url, index) => {
                    const isPreviewing = previewCandidateIndex === index || (previewCandidateIndex === null && asset.officialIndex === index);
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setPreviewCandidateIndex(index)}
                        className={cn(
                          'overflow-hidden rounded-[1.5rem] border-2 transition-smooth p-1 bg-background/50',
                          isPreviewing ? 'border-primary shadow-sm bg-primary/5' : 'border-transparent hover:border-primary/30 hover:bg-primary/5'
                        )}
                      >
                        <div className={cn(getAspectClass(asset.aspectRatio), 'w-full bg-muted/50 rounded-xl overflow-hidden')}>
                          <img src={url} alt={`${asset.name} 候选图 ${index + 1}`} className="h-full w-full object-cover" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {asset.officialIndex !== null && (
                <p className="mt-4 flex items-center gap-1.5 text-xs font-body font-bold text-green-600 bg-green-50 w-fit px-3 py-1.5 rounded-full">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  已选定正式版本（候选图 {asset.officialIndex + 1}）
                </p>
              )}

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  onClick={handleGenerateCandidates}
                  disabled={asset.generating}
                  className="gap-2 font-body btn-ink rounded-xl border-0 h-11"
                >
                  {asset.generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" />生成中…</>
                    : <><Wand2 className="w-4 h-4" />{asset.candidates.length > 0 ? '重新生成候选图' : '生成候选图'}</>}
                </Button>
                <Button
                  onClick={() => {
                    if (previewCandidateIndex !== null) handleSetOfficial(previewCandidateIndex);
                  }}
                  disabled={previewCandidateIndex === null || asset.generating}
                  variant="outline"
                  className="gap-2 font-body rounded-xl border-2 h-11 hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                >
                  <Check className="w-4 h-4" />
                  设为正式版本
                </Button>
              </div>
            </div>

            <WorkbenchHistoryCard
              title="历史记录"
              description={`查看并切换 ${asset.name} 的候选图历史。`}
            >
              <CandidateHistoryPanel
                asset={asset}
                onPreview={onPreview}
              />
            </WorkbenchHistoryCard>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

export default function Stage4Assets() {
  const { state, dispatch, triggerSave } = useStudio();
  const { assets } = state;
  const {
    generateAssetImage,
    generateBatchCharacterPrompts,
    generateBatchScenePrompts,
    generateBatchCharacterBaseImages,
    clearError,
  } = useStudioGenerate();
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [activeTab, setActiveTab] = useState<'characters' | 'scenes'>('characters');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [batchGeneratingTab, setBatchGeneratingTab] = useState<'characters' | 'scenes' | null>(null);
  const [batchImageGeneratingTab, setBatchImageGeneratingTab] = useState<'characters' | 'scenes' | null>(null);
  const charactersBatchTriggeredRef = useRef(false);
  const scenesBatchTriggeredRef = useRef(false);
  const mountedRef = useRef(true);
  const batchPromptRequestIdRef = useRef({ characters: 0, scenes: 0 });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const charactersReady = assets.characters.every(asset => Boolean(asset.baseImageUrl));
  const allOfficialSet = charactersReady;
  const hasAssets = assets.characters.length > 0 || assets.scenes.length > 0;
  const isBatchGenerating = batchGeneratingTab !== null || batchImageGeneratingTab !== null;

  const pendingCharacterBaseCount = useMemo(
    () => assets.characters.filter(asset => !asset.baseImageUrl).length,
    [assets.characters]
  );
  const pendingSceneImageCount = useMemo(
    () => assets.scenes.filter(asset => asset.candidates.length === 0).length,
    [assets.scenes]
  );

  const selectedCharacter = useMemo(
    () => assets.characters.find(asset => asset.id === selectedCharacterId) ?? assets.characters[0] ?? null,
    [assets.characters, selectedCharacterId]
  );

  const selectedScene = useMemo(
    () => assets.scenes.find(asset => asset.id === selectedSceneId) ?? assets.scenes[0] ?? null,
    [assets.scenes, selectedSceneId]
  );

  useEffect(() => {
    if (assets.characters.length === 0) {
      setSelectedCharacterId(null);
      return;
    }
    if (!selectedCharacterId || !assets.characters.some(asset => asset.id === selectedCharacterId)) {
      setSelectedCharacterId(assets.characters[0].id);
    }
  }, [assets.characters, selectedCharacterId]);

  useEffect(() => {
    if (assets.scenes.length === 0) {
      setSelectedSceneId(null);
      return;
    }
    if (!selectedSceneId || !assets.scenes.some(asset => asset.id === selectedSceneId)) {
      setSelectedSceneId(assets.scenes[0].id);
    }
  }, [assets.scenes, selectedSceneId]);

  useEffect(() => {
    if (activeTab !== 'characters' || charactersBatchTriggeredRef.current || assets.characters.length === 0) {
      return;
    }
    charactersBatchTriggeredRef.current = true;
    const targets = assets.characters.filter(asset => !(asset.prompt || '').trim() && !asset.promptUserEdited);
    if (targets.length === 0) {
      return;
    }

    void (async () => {
      const requestId = ++batchPromptRequestIdRef.current.characters;
      setBatchGeneratingTab('characters');
      try {
        const prompts = await generateBatchCharacterPrompts(targets, state.projectInfo);
        console.info('[Stage4Assets] batch character prompts finished', {
          targetCount: targets.length,
          returnedCount: prompts?.length || 0,
          returnedIds: prompts?.map(p => p.id),
        });
        if (!mountedRef.current || batchPromptRequestIdRef.current.characters !== requestId) return;
        if (prompts?.length) {
          prompts.forEach(item => {
            dispatch({
              type: 'UPDATE_ASSET_PROMPT',
              payload: {
                type: 'characters',
                id: item.id,
                prompt: item.prompt,
                userEdited: false,
              },
            });
          });
          triggerSave();
        }
      } finally {
        if (!mountedRef.current || batchPromptRequestIdRef.current.characters !== requestId) return;
        setBatchGeneratingTab(current => (current === 'characters' ? null : current));
      }
    })();
  }, [activeTab, assets.characters, dispatch, generateBatchCharacterPrompts, state.projectInfo, triggerSave]);

  useEffect(() => {
    if (activeTab !== 'scenes' || scenesBatchTriggeredRef.current || assets.scenes.length === 0) {
      return;
    }
    scenesBatchTriggeredRef.current = true;
    const targets = assets.scenes.filter(asset => !(asset.prompt || '').trim() && !asset.promptUserEdited);
    if (targets.length === 0) {
      return;
    }

    void (async () => {
      const requestId = ++batchPromptRequestIdRef.current.scenes;
      setBatchGeneratingTab('scenes');
      try {
        const prompts = await generateBatchScenePrompts(targets, state.projectInfo);
        console.info('[Stage4Assets] batch scene prompts finished', {
          targetCount: targets.length,
          returnedCount: prompts?.length || 0,
          returnedIds: prompts?.map(p => p.id),
        });
        if (!mountedRef.current || batchPromptRequestIdRef.current.scenes !== requestId) return;
        if (prompts?.length) {
          prompts.forEach(item => {
            dispatch({
              type: 'UPDATE_ASSET_PROMPT',
              payload: {
                type: 'scenes',
                id: item.id,
                prompt: item.prompt,
                userEdited: false,
              },
            });
          });
          triggerSave();
        }
      } finally {
        if (!mountedRef.current || batchPromptRequestIdRef.current.scenes !== requestId) return;
        setBatchGeneratingTab(current => (current === 'scenes' ? null : current));
      }
    })();
  }, [activeTab, assets.scenes, dispatch, generateBatchScenePrompts, state.projectInfo, triggerSave]);

  const handleBatchGenerateCharacterBaseImages = useCallback(async () => {
    const targets = assets.characters.filter(asset => !asset.generating);
    if (targets.length === 0) return;

    setBatchImageGeneratingTab('characters');
    try {
      const missingPromptTargets = targets.filter(asset => !(asset.prompt || '').trim() && !asset.promptUserEdited);
      let promptMap = new Map<string, string>();

      if (missingPromptTargets.length > 0) {
        const prompts = await generateBatchCharacterPrompts(missingPromptTargets, state.projectInfo);
        console.info('[Stage4Assets] batch character prompts for base images finished', {
          targetCount: missingPromptTargets.length,
          returnedCount: prompts?.length || 0,
          returnedIds: prompts?.map(p => p.id),
        });
        if (prompts?.length) {
          prompts.forEach(item => {
            promptMap.set(item.id, item.prompt);
            dispatch({
              type: 'UPDATE_ASSET_PROMPT',
              payload: {
                type: 'characters',
                id: item.id,
                prompt: item.prompt,
                userEdited: false,
              },
            });
          });
        }
      }

      const readyTargets = targets
        .map(asset => {
          const prompt = (asset.prompt || '').trim() || (promptMap.get(asset.id) || '').trim();
          return prompt ? { ...asset, prompt } : null;
        })
        .filter((asset): asset is AssetItem => Boolean(asset));

      const skippedIds = targets
        .filter(asset => {
          const prompt = (asset.prompt || '').trim() || (promptMap.get(asset.id) || '').trim();
          return !prompt;
        })
        .map(asset => asset.id);

      readyTargets.forEach(asset => {
        dispatch({
          type: 'SET_ASSET_GENERATING',
          payload: { type: 'characters', id: asset.id, generating: true, phase: 'character_base' },
        });
      });

      const result = await generateBatchCharacterBaseImages(readyTargets, state.projectInfo);
      const failedIds = new Set([...(result?.failedIds || []), ...skippedIds]);

      if (result?.images?.length) {
        result.images.forEach(item => {
          dispatch({ type: 'SET_CHARACTER_BASE_IMAGE', payload: { id: item.id, imageUrl: item.imageUrl } });
        });
        triggerSave();
      }

      [...failedIds, ...readyTargets.map(a => a.id)]
        .filter((id, idx, all) => all.indexOf(id) === idx)
        .forEach(id => {
          dispatch({
            type: 'SET_ASSET_GENERATING',
            payload: { type: 'characters', id, generating: false, phase: null },
          });
        });
    } finally {
      setBatchImageGeneratingTab(current => (current === 'characters' ? null : current));
    }
  }, [assets.characters, dispatch, generateBatchCharacterBaseImages, generateBatchCharacterPrompts, state.projectInfo, triggerSave]);

  const handleRegenerateAll = useCallback(async () => {
    clearError();

    if (activeTab === 'characters') {
      if (assets.characters.length === 0) return;
      setBatchGeneratingTab('characters');
      try {
        const prompts = await generateBatchCharacterPrompts(assets.characters, state.projectInfo);
        if (prompts?.length) {
          prompts.forEach(item => {
            dispatch({
              type: 'UPDATE_ASSET_PROMPT',
              payload: {
                type: 'characters',
                id: item.id,
                prompt: item.prompt,
                userEdited: false,
              },
            });
          });
          triggerSave();
        }
      } finally {
        setBatchGeneratingTab(current => (current === 'characters' ? null : current));
      }
      return;
    }

    if (assets.scenes.length === 0) return;
    setBatchGeneratingTab('scenes');
    try {
      const prompts = await generateBatchScenePrompts(assets.scenes, state.projectInfo);
      if (prompts?.length) {
        prompts.forEach(item => {
          dispatch({
            type: 'UPDATE_ASSET_PROMPT',
            payload: {
              type: 'scenes',
              id: item.id,
              prompt: item.prompt,
              userEdited: false,
            },
          });
        });
        triggerSave();
      }
    } finally {
      setBatchGeneratingTab(current => (current === 'scenes' ? null : current));
    }
  }, [activeTab, assets.characters, assets.scenes, clearError, dispatch, generateBatchCharacterPrompts, generateBatchScenePrompts, state.projectInfo, triggerSave]);

  const handleGenerateAllImages = useCallback(async () => {
    clearError();

    if (activeTab === 'characters') {
      await handleBatchGenerateCharacterBaseImages();
      return;
    }

    const targets = assets.scenes.filter(asset => !asset.generating);
    if (targets.length === 0) return;

    setBatchImageGeneratingTab('scenes');
    try {
      const missingPromptTargets = targets.filter(asset => !(asset.prompt || '').trim() && !asset.promptUserEdited);
      const promptMap = new Map<string, string>();

      if (missingPromptTargets.length > 0) {
        const prompts = await generateBatchScenePrompts(missingPromptTargets, state.projectInfo);
        if (prompts?.length) {
          prompts.forEach(item => {
            promptMap.set(item.id, item.prompt);
            dispatch({
              type: 'UPDATE_ASSET_PROMPT',
              payload: {
                type: 'scenes',
                id: item.id,
                prompt: item.prompt,
                userEdited: false,
              },
            });
          });
        }
      }

      for (const asset of targets) {
        const prompt = (asset.prompt || '').trim() || (promptMap.get(asset.id) || '').trim();
        if (!prompt) continue;

        dispatch({
          type: 'SET_ASSET_GENERATING',
          payload: { type: 'scenes', id: asset.id, generating: true, phase: 'scene_candidates' },
        });

        const candidatePrompts = [
          `${prompt}\n\n候选图版本 A：在保持主体一致前提下，突出空间结构与构图层次。`,
          `${prompt}\n\n候选图版本 B：在保持主体一致前提下，突出光影氛围与色彩情绪。`,
          `${prompt}\n\n候选图版本 C：在保持主体一致前提下，突出镜头景别与叙事张力。`,
        ];

        const images: string[] = [];
        let failed = false;

        for (const candidatePrompt of candidatePrompts) {
          const imageUrl = await generateAssetImage(
            {
              ...asset,
              prompt: candidatePrompt,
            },
            state.projectInfo
          );

          if (!imageUrl) {
            failed = true;
            break;
          }

          images.push(imageUrl);
        }

        if (failed || images.length !== candidatePrompts.length) {
          dispatch({
            type: 'SET_ASSET_GENERATING',
            payload: { type: 'scenes', id: asset.id, generating: false, phase: null },
          });
          continue;
        }

        dispatch({ type: 'SET_SCENE_CANDIDATES', payload: { id: asset.id, candidates: images } });
        triggerSave();
      }
    } finally {
      setBatchImageGeneratingTab(current => (current === 'scenes' ? null : current));
    }
  }, [activeTab, assets.scenes, clearError, dispatch, generateAssetImage, generateBatchScenePrompts, handleBatchGenerateCharacterBaseImages, state.projectInfo, triggerSave]);

  function handleConfirm() {
    dispatch({ type: 'COMPLETE_STAGE', payload: 3 });
    triggerSave();
  }

  const activeAssetCount = activeTab === 'characters' ? assets.characters.length : assets.scenes.length;
  const isHeaderRegenerating = batchGeneratingTab === activeTab;
  const isHeaderGeneratingImages = batchImageGeneratingTab === activeTab;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-primary/5 to-transparent pointer-events-none" />

      <StageActionHeader
        title="素材设定"
        onRegenerate={() => {
          void handleRegenerateAll();
        }}
        onNext={handleConfirm}
        regenerateDisabled={isBatchGenerating || activeAssetCount === 0}
        regenerating={isHeaderRegenerating}
        nextDisabled={!allOfficialSet}
        extraActions={(
          <Button
            type="button"
            onClick={() => {
              void handleGenerateAllImages();
            }}
            disabled={isBatchGenerating || activeAssetCount === 0}
            className="gap-2 font-body btn-ink rounded-full border-0 px-6"
          >
            {isHeaderGeneratingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {isHeaderGeneratingImages ? '生成中…' : '生成全部图片'}
          </Button>
        )}
      />

      {!hasAssets ? (
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-20 h-20 rounded-[2rem] bg-muted/50 border-2 border-dashed border-border flex items-center justify-center mx-auto shadow-sm">
              <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-body font-medium text-muted-foreground tracking-wide">素材将从故事阶段的角色和场景清单中自动导入</p>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as 'characters' | 'scenes')} className="flex min-h-0 flex-1 flex-col relative z-10">
          <div className="mb-6 self-start rounded-[1.5rem] card-ink p-1.5 shadow-ink-light flex items-center border-2 border-border/50 shrink-0">
            <TabsList className="h-auto bg-transparent p-0 gap-2">
              <TabsTrigger value="characters" disabled={isBatchGenerating} className="gap-2 rounded-xl px-5 py-2.5 font-body font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-smooth">
                <Users className="w-4 h-4" />
                角色设定
                <span className="text-xs opacity-70">({assets.characters.length})</span>
              </TabsTrigger>
              <TabsTrigger value="scenes" disabled={isBatchGenerating} className="gap-2 rounded-xl px-5 py-2.5 font-body font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-smooth">
                <MapPin className="w-4 h-4" />
                场景设定
                <span className="text-xs opacity-70">({assets.scenes.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="characters" className="mt-0 min-h-0 flex-1 data-[state=active]:flex data-[state=inactive]:hidden flex-col gap-4 outline-none">
            {batchGeneratingTab === 'characters' ? (
              <div className="flex flex-1 min-h-[420px] items-center justify-center rounded-[2rem] card-ink shadow-ink-light">
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shadow-glow animate-pulse">
                    <Wand2 className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-base font-body font-medium text-muted-foreground tracking-wide">正在批量生成角色 AI 绘画提示词，请稍候…</p>
                </div>
              </div>
            ) : batchImageGeneratingTab === 'characters' ? (
              <div className="flex flex-1 min-h-[420px] items-center justify-center rounded-[2rem] card-ink shadow-ink-light">
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shadow-glow animate-pulse">
                    <Wand2 className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-base font-body font-medium text-muted-foreground tracking-wide">正在批量生成角色参考图（基础形象），请稍候…</p>
                </div>
              </div>
            ) : selectedCharacter ? (
              <>
                <div className="flex-1 min-h-0 grid gap-6 xl:grid-cols-[240px_minmax(0,1.35fr)_minmax(360px,0.92fr)]">
                  <WorkbenchListPanel
                    title="角色卷宗"
                    description="选择当前要编辑的角色，右侧面板会聚焦展示。"
                    items={assets.characters.map(asset => ({ id: asset.id, name: asset.name, status: asset.status }))}
                    selectedId={selectedCharacter.id}
                    onSelect={setSelectedCharacterId}
                    actions={(
                      <div className="rounded-xl bg-background/50 px-4 py-2.5 text-xs font-body text-muted-foreground border-2 border-border/50">
                        待生成参考图：<span className="font-bold text-foreground ml-1">{pendingCharacterBaseCount}</span>
                      </div>
                    )}
                  />

                  <CharacterWorkbenchDetail asset={selectedCharacter} onPreview={setPreview} />
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="scenes" className="mt-0 min-h-0 flex-1 data-[state=active]:flex data-[state=inactive]:hidden flex-col gap-4 outline-none">
            {batchGeneratingTab === 'scenes' ? (
              <div className="flex flex-1 min-h-[420px] items-center justify-center rounded-[2rem] card-ink shadow-ink-light">
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shadow-glow animate-pulse">
                    <Wand2 className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-base font-body font-medium text-muted-foreground tracking-wide">正在批量生成场景 AI 绘画提示词，请稍候…</p>
                </div>
              </div>
            ) : selectedScene ? (
              <>
                <div className="flex-1 min-h-0 grid gap-6 xl:grid-cols-[240px_minmax(0,1.35fr)_minmax(360px,0.92fr)]">
                  <WorkbenchListPanel
                    title="场景卷宗"
                    description="选择当前要编辑的场景，右侧面板会聚焦展示。"
                    items={assets.scenes.map(asset => ({ id: asset.id, name: asset.name, status: asset.status }))}
                    selectedId={selectedScene.id}
                    onSelect={setSelectedSceneId}
                    actions={(
                      <div className="rounded-xl bg-background/50 px-4 py-2.5 text-xs font-body text-muted-foreground border-2 border-border/50">
                        待生成场景图片：<span className="font-bold text-foreground ml-1">{pendingSceneImageCount}</span>
                      </div>
                    )}
                  />

                  <SceneWorkbenchDetail asset={selectedScene} onPreview={setPreview} />
                </div>
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      )}

      <ImagePreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        imageUrl={preview?.imageUrl || ''}
        alt={preview?.alt || '素材预览'}
      />

    </div>
  );
}
