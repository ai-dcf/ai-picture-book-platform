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
      'text-[10px] px-1.5 py-0.5 rounded font-body',
      asset.status === 'official_confirmed' && 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
      asset.status === 'candidates_generated' && 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
      asset.status === 'not_generated' && 'bg-muted text-muted-foreground',
      (asset.status === 'pending_update' || asset.status === 'review') && 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
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
      <div className="space-y-1.5 mb-3">
        <p className="text-[11px] font-body text-muted-foreground">角色形象描述</p>
        <Textarea
          value={asset.description}
          onChange={e => handleDescChange(e.target.value)}
          placeholder={assetType === 'characters' ? '描述角色外观、服饰、气质与关键特征…' : '描述场景氛围、空间元素与时代背景…'}
          className="font-body text-xs resize-none min-h-[56px]"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-body text-muted-foreground">AI绘画提示词</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
            <button
              type="button"
              onClick={handleResetPrompt}
              disabled={promptActionDisabled}
              className="text-[11px] text-primary font-body hover:underline"
            >
              {isPromptGenerating ? '重新生成中…' : '重新生成AI绘画提示词'}
            </button>
          </div>
        </div>
        <Textarea
          value={asset.prompt || ''}
          onChange={e => handlePromptChange(e.target.value)}
          placeholder="系统会自动生成素材提示词，你也可以继续编辑…"
          className="font-body text-xs resize-none min-h-[104px]"
        />
      </div>
    </>
  );
}

function LoadingTiles({ count = 3, aspectRatio = '1:1' }: { count?: number; aspectRatio?: AspectRatio }) {
  return (
    <div className={cn('grid gap-2', count === 1 ? 'grid-cols-1' : 'grid-cols-3')}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'rounded-lg bg-muted overflow-hidden relative',
            getAspectClass(aspectRatio),
          )}
          style={{ animationDelay: `${index * 0.15}s` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent animate-shimmer bg-[length:200%_100%]" />
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
      'rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 bg-muted/30',
      getAspectClass(aspectRatio),
      className,
    )}>
      <ImageIcon className="w-6 h-6 text-muted-foreground" />
      <span className="text-xs font-body text-muted-foreground">{label}</span>
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
        'rounded-lg overflow-hidden relative border-2 transition-all group',
        isSelected
          ? 'border-primary shadow-glow'
          : 'border-transparent hover:border-primary/40',
      )}
      onClick={onClick}
    >
      <div className={cn(getAspectClass(aspectRatio), 'w-full bg-muted')}>
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
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-primary-foreground" />
        </div>
      )}
      <p className="text-[10px] text-center font-body text-muted-foreground mt-0.5">
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-body">切换基础形象</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="rounded-lg overflow-hidden border border-border bg-muted max-w-[240px] mx-auto">
                <img
                  src={imageUrl}
                  alt="待切换的基础形象"
                  className="w-full object-cover"
                />
              </div>
              <p className="text-sm font-body text-muted-foreground">
                切换后，当前已确认的基础形象将被替换。确定切换？
              </p>
              <p className="text-xs font-body text-muted-foreground">
                生成时间：{formatTimestamp(timestamp)}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-body">取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="font-body">确认切换</AlertDialogAction>
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-body">切换候选图</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {candidates.map((url, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-border bg-muted">
                    <img
                      src={url}
                      alt={`候选图 ${i + 1}`}
                      className="w-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm font-body text-muted-foreground">
                切换后，当前已选的正式版本将被重置。确定切换？
              </p>
              <p className="text-xs font-body text-muted-foreground">
                第 {roundIndex + 1} 轮 · {formatTimestamp(timestamp)}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-body">取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="font-body">确认切换</AlertDialogAction>
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
    <div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground hover:text-foreground transition-colors w-full py-1"
          >
            <History className="w-3 h-3" />
            历史版本 ({history.length})
            <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-5 gap-2 pt-2">
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
    <div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground hover:text-foreground transition-colors w-full py-1"
          >
            <History className="w-3 h-3" />
            候选图历史 ({history.length})
            <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 pt-2">
            {history.map((entry, index) => {
              const isOfficial = asset.officialImageUrl && entry.candidates.includes(asset.officialImageUrl);
              return (
                <div
                  key={entry.timestamp}
                  className={cn(
                    'rounded-lg border-2 p-2 transition-all cursor-pointer',
                    isOfficial
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                  onClick={() => handleSelect(index)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-body text-muted-foreground">
                      第 {history.length - index} 轮 · {formatTimestamp(entry.timestamp)}
                    </span>
                    {isOfficial && (
                      <span className="flex items-center gap-1 text-[10px] font-body text-primary">
                        <Check className="w-3 h-3" />
                        已确认
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {entry.candidates.map((url, i) => (
                      <div key={i} className="rounded overflow-hidden border border-border bg-muted">
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

function CharacterCard({
  asset,
  onPreview,
}: {
  asset: AssetItem;
  onPreview: (payload: PreviewPayload) => void;
}) {
  const { state, dispatch, triggerSave } = useStudio();
  const { generateAssetImage, generateCharacterPrompt } = useStudioGenerate();
  const hasPrompt = Boolean((asset.prompt || '').trim());
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
      if (!prompt) {
        return;
      }
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
    <div className="border border-border rounded-xl p-4 bg-card shadow-card space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-body font-semibold text-foreground flex-1 truncate">{asset.name}</h4>
        <AssetStatusBadge asset={asset} />
      </div>
      {asset.status === 'review' && (
        <p className="text-[11px] font-body text-amber-600">画面比例已变更，建议重新生成</p>
      )}

      <AssetPromptEditor
        asset={asset}
        assetType="characters"
        onGeneratePrompt={async () => { await generatePromptFromModel(); }}
        isPromptGenerating={asset.generatingPhase === 'character_prompt'}
      />

      <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-body text-muted-foreground">基础形象</p>
            <div className="flex items-center gap-2">
              <Select value={asset.aspectRatio} onValueChange={handleAspectRatioChange}>
                <SelectTrigger className="h-7 w-[94px] text-[11px] font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map(ratio => (
                    <SelectItem key={ratio} value={ratio} className="font-body text-xs">
                      {ratio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            {baseConfirmed && (
              <div className="flex items-center gap-1 text-[11px] text-green-600 font-body">
                <Check className="w-3 h-3" />
                已确认
              </div>
            )}
            </div>
          </div>

          {asset.generating && asset.generatingPhase === 'character_base' ? (
            <LoadingTiles count={1} aspectRatio={asset.aspectRatio} />
          ) : asset.baseImageUrl ? (
            <div className={cn(getAspectClass(asset.aspectRatio), 'rounded-lg overflow-hidden border border-border bg-muted')}>
              <img
                src={asset.baseImageUrl}
                alt={`${asset.name} 基础形象`}
                className="w-full h-full object-cover cursor-pointer hover:scale-[1.02] transition-transform"
                onClick={() => onPreview({ imageUrl: asset.baseImageUrl!, alt: `${asset.name} 基础形象` })}
              />
            </div>
          ) : (
            <EmptyPreview label="暂无基础形象图" aspectRatio={asset.aspectRatio} />
          )}

          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={handleGenerateBase}
              disabled={asset.generating}
              size="sm"
              variant={asset.baseImageUrl ? 'outline' : 'default'}
              className={cn(
                'w-full gap-2 font-body text-xs',
                !asset.baseImageUrl && 'gradient-hero text-primary-foreground border-0'
              )}
            >
              {asset.generating && asset.generatingPhase === 'character_base' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成基础形象中…</>
              ) : (
                <><Wand2 className="w-3.5 h-3.5" />{asset.baseImageUrl ? '重新生成基础形象' : '生成基础形象'}</>
              )}
            </Button>

            <Button
              onClick={handleConfirmBase}
              disabled={!asset.baseImageUrl || asset.generating}
              size="sm"
              variant="secondary"
              className="w-full gap-2 font-body text-xs"
            >
              <Check className="w-3.5 h-3.5" />
              确认基础形象
            </Button>
          </div>

          <BaseImageHistoryPanel
            asset={asset}
            assetType="characters"
            onPreview={onPreview}
          />
        </div>
    </div>
  );
}

function SceneCard({
  asset,
  onPreview,
}: {
  asset: AssetItem;
  onPreview: (payload: PreviewPayload) => void;
}) {
  const { state, dispatch, triggerSave } = useStudio();
  const { generateAssetImage, generateScenePrompt } = useStudioGenerate();
  const hasPrompt = Boolean((asset.prompt || '').trim());

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
      if (!basePrompt) {
        return;
      }
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

  return (
    <div className="border border-border rounded-xl p-4 bg-card shadow-card space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-body font-semibold text-foreground flex-1 truncate">{asset.name}</h4>
        <Select value={asset.aspectRatio} onValueChange={handleAspectRatioChange}>
          <SelectTrigger className="h-7 w-[94px] text-[11px] font-body">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASPECT_RATIOS.map(ratio => (
              <SelectItem key={ratio} value={ratio} className="font-body text-xs">
                {ratio}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AssetStatusBadge asset={asset} />
      </div>
      {asset.status === 'review' && (
        <p className="text-[11px] font-body text-amber-600">画面比例已变更，建议重新生成</p>
      )}

      <AssetPromptEditor
        asset={asset}
        assetType="scenes"
        onGeneratePrompt={async () => { await generatePromptFromModel(); }}
        isPromptGenerating={asset.generatingPhase === 'scene_prompt'}
      />

      <Button
        onClick={handleGenerateCandidates}
        disabled={asset.generating}
        size="sm"
        variant={asset.candidates.length > 0 ? 'outline' : 'default'}
        className={cn(
          'w-full gap-2 font-body text-xs',
          asset.candidates.length === 0 && 'gradient-hero text-primary-foreground border-0'
        )}
      >
        {asset.generating ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成候选图中…</>
        ) : (
          <><Wand2 className="w-3.5 h-3.5" />{asset.candidates.length > 0 ? '重新生成候选图' : '生成 3 张候选图'}</>
        )}
      </Button>

      {asset.generating && asset.generatingPhase === 'scene_candidates' ? (
        <LoadingTiles count={3} aspectRatio={asset.aspectRatio} />
      ) : asset.candidates.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-body text-muted-foreground">选择正式版本</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {asset.candidates.map((url, index) => (
              <div
                key={index}
                className={cn(
                  'rounded-lg overflow-hidden relative border-2 transition-smooth group',
                  asset.officialIndex === index
                    ? 'border-primary shadow-glow'
                    : 'border-transparent hover:border-primary/40'
                )}
              >
                <button
                  type="button"
                  className={cn(getAspectClass(asset.aspectRatio), 'w-full overflow-hidden bg-muted')}
                  onClick={() => onPreview({ imageUrl: url, alt: `${asset.name} 候选图 ${index + 1}` })}
                >
                  <img
                    src={url}
                    alt={`${asset.name} 候选图 ${index + 1}`}
                    className="w-full h-full object-cover cursor-pointer hover:scale-[1.02] transition-transform"
                  />
                </button>
                <div className="p-2 border-t border-border bg-card/90">
                  <Button
                    size="sm"
                    variant={asset.officialIndex === index ? 'secondary' : 'outline'}
                    className="w-full text-xs font-body"
                    onClick={() => handleSetOfficial(index)}
                  >
                    {asset.officialIndex === index ? '已设为正式版本' : '设为正式版本'}
                  </Button>
                </div>
                {asset.officialIndex === index && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center pointer-events-none">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {asset.officialIndex !== null ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-body">
              <Star className="w-3 h-3 fill-current" />
              已选定正式版本（候选图 {asset.officialIndex + 1}）
            </div>
          ) : (
            <p className="text-xs text-muted-foreground font-body">点击候选图设为正式版本</p>
          )}

          <CandidateHistoryPanel
            asset={asset}
            onPreview={onPreview}
          />
        </div>
      ) : (
        <EmptyPreview label="暂无候选图" aspectRatio={asset.aspectRatio} />
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
    <div className="self-start rounded-2xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-4">
        <p className="text-[11px] font-body font-medium uppercase tracking-[0.18em] text-muted-foreground">
          素材列表
        </p>
        {actions ? <div className="mt-4">{actions}</div> : null}
      </div>

      <ScrollArea className="max-h-[560px]">
        <div className="space-y-2 p-3">
          {items.map(item => {
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  'w-full rounded-xl border px-3 py-3 text-left transition-smooth',
                  isSelected
                    ? 'border-primary/30 bg-primary/10 shadow-sm'
                    : 'border-transparent bg-background hover:border-border hover:bg-muted/60'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('text-sm font-body font-medium', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                    {item.name}
                  </span>
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
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
    <div className="rounded-2xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-4">
        <h4 className="font-display text-base text-foreground">{title}</h4>
        <p className="mt-1 text-xs font-body text-muted-foreground">{description}</p>
      </div>
      <div className="px-4 py-4">{children}</div>
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
      <div className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-body font-medium uppercase tracking-[0.18em] text-muted-foreground">
              编辑面板
            </p>
          </div>
          <AssetStatusBadge asset={asset} />
        </div>

        {asset.status === 'review' && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-body text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
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

      <div className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-body font-medium uppercase tracking-[0.18em] text-muted-foreground">
              预览面板
            </p>
            <h3 className="mt-2 font-display text-lg text-foreground">基础形象预览</h3>
            <p className="mt-1 text-xs font-body text-muted-foreground">优先查看当前角色的生成结果，再执行确认操作。</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={asset.aspectRatio} onValueChange={handleAspectRatioChange}>
              <SelectTrigger className="h-8 w-[96px] text-xs font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map(ratio => (
                  <SelectItem key={ratio} value={ratio} className="font-body text-xs">
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {baseConfirmed && (
              <div className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-body text-green-700 dark:bg-green-950/30 dark:text-green-300">
                <Check className="h-3 w-3" />
                已确认
              </div>
            )}
          </div>
        </div>

        {asset.generating && asset.generatingPhase === 'character_base' ? (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-border bg-muted/30 p-4">
            <div className="w-full max-w-[280px]">
              <LoadingTiles count={1} aspectRatio={asset.aspectRatio} />
            </div>
          </div>
        ) : asset.baseImageUrl ? (
          <button
            type="button"
            className="group flex h-[360px] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30 p-4"
            onClick={() => onPreview({ imageUrl: asset.baseImageUrl!, alt: `${asset.name} 基础形象` })}
          >
            <img
              src={asset.baseImageUrl}
              alt={`${asset.name} 基础形象`}
              className="max-h-full max-w-full rounded-xl object-contain transition-transform group-hover:scale-[1.015]"
            />
          </button>
        ) : (
          <EmptyPreview label="暂无基础形象图" aspectRatio={asset.aspectRatio} className="h-[360px]" />
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            onClick={handleGenerateBase}
            disabled={asset.generating}
            className="gap-2 font-body gradient-hero text-primary-foreground border-0"
          >
            {asset.generating && asset.generatingPhase === 'character_base'
              ? <><Loader2 className="w-4 h-4 animate-spin" />生成中…</>
              : <><Wand2 className="w-4 h-4" />{asset.baseImageUrl ? '重新生成' : '生成基础形象'}</>}
          </Button>
          <Button
            onClick={handleConfirmBase}
            disabled={!asset.baseImageUrl || asset.generating}
            variant="outline"
            className="gap-2 font-body"
          >
            <Check className="w-4 h-4" />
            确认基础形象
          </Button>
        </div>
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
      <div className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-body font-medium uppercase tracking-[0.18em] text-muted-foreground">
              编辑面板
            </p>
          </div>
          <AssetStatusBadge asset={asset} />
        </div>

        {asset.status === 'review' && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-body text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
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

      <div className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-body font-medium uppercase tracking-[0.18em] text-muted-foreground">
              预览面板
            </p>
            <h3 className="mt-2 font-display text-lg text-foreground">场景预览</h3>
            <p className="mt-1 text-xs font-body text-muted-foreground">优先查看候选图，再设定当前正式版本。</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={asset.aspectRatio} onValueChange={handleAspectRatioChange}>
              <SelectTrigger className="h-8 w-[96px] text-xs font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map(ratio => (
                  <SelectItem key={ratio} value={ratio} className="font-body text-xs">
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AssetStatusBadge asset={asset} />
          </div>
        </div>

        {asset.generating && asset.generatingPhase === 'scene_candidates' ? (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-border bg-muted/30 p-4">
            <div className="w-full max-w-[280px]">
              <LoadingTiles count={1} aspectRatio={asset.aspectRatio} />
            </div>
          </div>
        ) : previewUrl ? (
          <button
            type="button"
            className="group flex h-[360px] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30 p-4"
            onClick={() => onPreview({ imageUrl: previewUrl, alt: `${asset.name} 场景预览` })}
          >
            <img
              src={previewUrl}
              alt={`${asset.name} 场景预览`}
              className="max-h-full max-w-full rounded-xl object-contain transition-transform group-hover:scale-[1.015]"
            />
          </button>
        ) : (
          <EmptyPreview label="暂无场景候选图" aspectRatio={asset.aspectRatio} className="h-[360px]" />
        )}

        {asset.candidates.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {asset.candidates.map((url, index) => {
              const isPreviewing = previewCandidateIndex === index || (previewCandidateIndex === null && asset.officialIndex === index);
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => setPreviewCandidateIndex(index)}
                  className={cn(
                    'overflow-hidden rounded-xl border-2 transition-smooth',
                    isPreviewing ? 'border-primary shadow-sm' : 'border-transparent hover:border-primary/40'
                  )}
                >
                  <div className={cn(getAspectClass(asset.aspectRatio), 'w-full bg-muted')}>
                    <img src={url} alt={`${asset.name} 候选图 ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {asset.officialIndex !== null && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-body text-green-600">
            <Star className="h-3 w-3 fill-current" />
            已选定正式版本（候选图 {asset.officialIndex + 1}）
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            onClick={handleGenerateCandidates}
            disabled={asset.generating}
            className="gap-2 font-body gradient-hero text-primary-foreground border-0"
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
            className="gap-2 font-body"
          >
            <Check className="w-4 h-4" />
            设为正式版本
          </Button>
        </div>
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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <StageActionHeader
        title="素材设定"
        description="角色基础形象为必填项，场景视图为选填项；所有角色完成基础形象生成后即可进入逐页生成"
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
            className="gap-2 font-body bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
            variant="outline"
          >
            {isHeaderGeneratingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {isHeaderGeneratingImages ? '生成中…' : '生成全部图片'}
          </Button>
        )}
      />

      {!hasAssets ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">素材将从故事阶段的角色和场景清单中自动导入</p>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as 'characters' | 'scenes')} className="flex min-h-0 flex-1 flex-col">
          <div className="mb-4 self-start rounded-2xl border border-border bg-card/80 p-1 shadow-card">
            <TabsList className="h-auto bg-transparent p-0">
              <TabsTrigger value="characters" disabled={isBatchGenerating} className="gap-2 rounded-xl px-4 py-2.5 font-body data-[state=active]:shadow-none">
                <Users className="w-4 h-4" />
                角色设定
                <span className="text-xs text-muted-foreground">({assets.characters.length})</span>
              </TabsTrigger>
              <TabsTrigger value="scenes" disabled={isBatchGenerating} className="gap-2 rounded-xl px-4 py-2.5 font-body data-[state=active]:shadow-none">
                <MapPin className="w-4 h-4" />
                场景设定
                <span className="text-xs text-muted-foreground">({assets.scenes.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="characters" className="mt-0 space-y-4">
            {batchGeneratingTab === 'characters' ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-border bg-card/70">
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full gradient-hero animate-pulse-soft">
                    <Wand2 className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <p className="text-sm font-body text-muted-foreground">正在批量生成角色 AI 绘画提示词，请稍候…</p>
                </div>
              </div>
            ) : batchImageGeneratingTab === 'characters' ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-border bg-card/70">
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full gradient-hero animate-pulse-soft">
                    <Wand2 className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <p className="text-sm font-body text-muted-foreground">正在批量生成角色参考图（基础形象），请稍候…</p>
                </div>
              </div>
            ) : selectedCharacter ? (
              <>
                <div className="grid items-start gap-4 xl:grid-cols-[200px_minmax(0,1.35fr)_minmax(320px,0.92fr)]">
                  <WorkbenchListPanel
                    title="角色分类"
                    description="选择当前要编辑的角色，右侧面板会聚焦展示该角色的描述、提示词与基础形象。"
                    items={assets.characters.map(asset => ({ id: asset.id, name: asset.name, status: asset.status }))}
                    selectedId={selectedCharacter.id}
                    onSelect={setSelectedCharacterId}
                    actions={(
                      <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs font-body text-muted-foreground">
                        待生成参考图：<span className="font-medium text-foreground">{pendingCharacterBaseCount}</span>
                      </div>
                    )}
                  />

                  <CharacterWorkbenchDetail asset={selectedCharacter} onPreview={setPreview} />
                </div>

                <WorkbenchHistoryCard
                  title="历史版本记录"
                  description={`查看并切换 ${selectedCharacter.name} 的基础形象历史版本。`}
                >
                  <BaseImageHistoryPanel
                    asset={selectedCharacter}
                    assetType="characters"
                    onPreview={setPreview}
                  />
                </WorkbenchHistoryCard>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="scenes" className="mt-0 space-y-4">
            {batchGeneratingTab === 'scenes' ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-border bg-card/70">
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full gradient-hero animate-pulse-soft">
                    <Wand2 className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <p className="text-sm font-body text-muted-foreground">正在批量生成场景 AI 绘画提示词，请稍候…</p>
                </div>
              </div>
            ) : selectedScene ? (
              <>
                <div className="grid items-start gap-4 xl:grid-cols-[200px_minmax(0,1.35fr)_minmax(320px,0.92fr)]">
                  <WorkbenchListPanel
                    title="场景分类"
                    description="选择当前要编辑的场景，右侧面板会聚焦展示场景描述、提示词与候选图。"
                    items={assets.scenes.map(asset => ({ id: asset.id, name: asset.name, status: asset.status }))}
                    selectedId={selectedScene.id}
                    onSelect={setSelectedSceneId}
                    actions={(
                      <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs font-body text-muted-foreground">
                        待生成场景图片：<span className="font-medium text-foreground">{pendingSceneImageCount}</span>
                      </div>
                    )}
                  />

                  <SceneWorkbenchDetail asset={selectedScene} onPreview={setPreview} />
                </div>

                <WorkbenchHistoryCard
                  title="历史版本记录"
                  description={`查看并切换 ${selectedScene.name} 的候选图历史。`}
                >
                  <CandidateHistoryPanel
                    asset={selectedScene}
                    onPreview={setPreview}
                  />
                </WorkbenchHistoryCard>
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
