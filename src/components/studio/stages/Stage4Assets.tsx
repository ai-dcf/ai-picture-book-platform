"use client";
import { useState, useRef, useEffect } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useStudioGenerate } from '@/modules/studio/presentation/hooks/use-studio-generate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  ArrowRight,
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
import { buildAssetPrompt, buildUserFriendlyAssetPrompt } from '@/prompts';

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
}: {
  label: string;
  aspectRatio?: AspectRatio;
}) {
  return (
    <div className={cn(
      'rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 bg-muted/30',
      getAspectClass(aspectRatio),
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
  const autoPromptRequestedRef = useRef<string | null>(null);

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

  useEffect(() => {
    const autoPromptKey = `${state.projectInfo.artStyle}|${asset.name}|${asset.description}`;
    if (hasPrompt || asset.promptUserEdited || asset.generating || autoPromptRequestedRef.current === autoPromptKey) {
      return;
    }
    autoPromptRequestedRef.current = autoPromptKey;
    void generatePromptFromModel();
  }, [asset.description, asset.generating, asset.name, asset.promptUserEdited, hasPrompt, state.projectInfo.artStyle]);

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
  const { generateAssetImage } = useStudioGenerate();
  const hasPrompt = Boolean((asset.prompt || '').trim());

  function ensurePrompt() {
    if (hasPrompt) return;
    dispatch({
      type: 'UPDATE_ASSET_PROMPT',
      payload: {
        type: 'scenes',
        id: asset.id,
        prompt: buildUserFriendlyAssetPrompt({
          kind: 'scene',
          name: asset.name,
          description: asset.description,
          projectInfo: { ...state.projectInfo, aspectRatio: asset.aspectRatio },
        }),
        userEdited: false,
      },
    });
  }

  async function handleGenerateCandidates() {
    const basePrompt = hasPrompt
      ? asset.prompt
      : buildAssetPrompt({
          kind: 'scene',
          name: asset.name,
          description: asset.description,
          projectInfo: { ...state.projectInfo, aspectRatio: asset.aspectRatio },
        });
    const candidatePrompts = [
      `${basePrompt}\n\n候选图版本 A：在保持主体一致前提下，突出空间结构与构图层次。`,
      `${basePrompt}\n\n候选图版本 B：在保持主体一致前提下，突出光影氛围与色彩情绪。`,
      `${basePrompt}\n\n候选图版本 C：在保持主体一致前提下，突出镜头景别与叙事张力。`,
    ];

    ensurePrompt();
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

      <AssetPromptEditor asset={asset} assetType="scenes" />

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

export default function Stage4Assets() {
  const { state, dispatch, triggerSave } = useStudio();
  const { assets } = state;
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  const charactersReady = assets.characters.every(asset => Boolean(asset.baseImageUrl));
  const allOfficialSet = charactersReady;
  const hasAssets = assets.characters.length > 0 || assets.scenes.length > 0;

  function handleConfirm() {
    dispatch({ type: 'COMPLETE_STAGE', payload: 3 });
    triggerSave();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ImageIcon className="w-4 h-4 text-primary" />
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">阶段 3 · 素材设定</span>
        </div>
        <h2 className="font-display text-2xl text-foreground">素材设定</h2>
        <p className="text-sm font-body text-muted-foreground mt-1">
          角色基础形象为必填项，场景视图为选填项；所有角色完成基础形象生成后即可进入逐页生成
        </p>
      </div>

      {!hasAssets ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2 max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">素材将从故事阶段的角色和场景清单中自动导入</p>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="characters" className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-fit mb-4">
            <TabsTrigger value="characters" className="gap-1.5 font-body">
              <Users className="w-3.5 h-3.5" />
              角色设定
              <span className="ml-1 text-xs text-muted-foreground">({assets.characters.length})</span>
            </TabsTrigger>
            <TabsTrigger value="scenes" className="gap-1.5 font-body">
              <MapPin className="w-3.5 h-3.5" />
              场景设定
              <span className="ml-1 text-xs text-muted-foreground">({assets.scenes.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="characters" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full -mr-4 pr-4">
              <div className="grid grid-cols-1 gap-4 pb-4">
                {assets.characters.map(asset => (
                  <CharacterCard
                    key={asset.id}
                    asset={asset}
                    onPreview={setPreview}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="scenes" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full -mr-4 pr-4">
              <div className="grid grid-cols-1 gap-4 pb-4">
                {assets.scenes.map(asset => (
                  <SceneCard
                    key={asset.id}
                    asset={asset}
                    onPreview={setPreview}
                  />
                ))}
              </div>
            </ScrollArea>
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

      <div className="pt-4 mt-auto border-t border-border flex items-center justify-between gap-4">
        <div className="text-xs font-body text-muted-foreground">
          {allOfficialSet ? (
            <span className="text-green-600">所有角色基础形象已生成，可进入逐页生成</span>
          ) : (
            <span className="text-amber-600">所有角色都需要先生成基础形象；场景视图可稍后补充</span>
          )}
        </div>
        <Button
          onClick={handleConfirm}
          disabled={!allOfficialSet}
          className={cn(
            'gap-2 font-body gradient-hero text-primary-foreground border-0',
            !allOfficialSet && 'opacity-50 cursor-not-allowed'
          )}
        >
          确认素材，进入逐页生成
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
