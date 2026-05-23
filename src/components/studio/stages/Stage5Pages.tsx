"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useStudioGenerate } from '@/modules/studio/presentation/hooks/use-studio-generate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PromptEditor from '@/components/studio/PromptEditor';
import { cn } from '@/lib/utils';
import { PageStatus, PAGE_STATUS_LABELS, AspectRatio } from '@/types/picturebook';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Expand,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Wand2,
} from 'lucide-react';

function pageStatusIcon(s: PageStatus) {
  const map: Record<PageStatus, { icon: React.ElementType; color: string }> = {
    idle: { icon: Circle, color: 'text-muted-foreground' },
    pending: { icon: Circle, color: 'text-amber-500' },
    generating: { icon: Loader2, color: 'text-primary' },
    generated: { icon: ImageIcon, color: 'text-green-500' },
    review: { icon: AlertTriangle, color: 'text-amber-500' },
    finalized: { icon: CheckCircle2, color: 'text-green-600' },
  };
  return map[s];
}

function getAspectClass(ratio: AspectRatio) {
  const map: Record<AspectRatio, string> = {
    '3:4': 'aspect-[3/4]',
    '9:16': 'aspect-[9/16]',
    '16:9': 'aspect-[16/9]',
    '1:1': 'aspect-square',
  };
  return map[ratio];
}

export default function Stage5Pages() {
  const { state, dispatch, triggerSave } = useStudio();
  const { generatePageImage, generatePagePrompt, error, clearError, getErrorMessage } = useStudioGenerate();
  const router = useRouter();
  const { pages, storyboard, assets, projectInfo } = state;
  const [currentPage, setCurrentPage] = useState(0);
  const [previewState, setPreviewState] = useState<{ open: boolean; imageUrl: string; alt: string }>({ open: false, imageUrl: '', alt: '' });
  const [promptGeneratingPage, setPromptGeneratingPage] = useState<number | null>(null);
  const [promptErrorPage, setPromptErrorPage] = useState<number | null>(null);
  const autoPromptRequestedRef = useRef<Record<number, string>>({});
  const generatedCount = pages.filter(item => Boolean(item.imageUrl)).length;
  const allGenerated = pages.length > 0 && pages.every(item => Boolean(item.imageUrl));
  const finalizedCount = pages.filter(item => item.pageStatus === 'finalized').length;

  const page = pages[currentPage];
  const sbPage = storyboard.pages[currentPage];
  const effectiveCharacterRefs = useMemo(
    () => assets.characters.map(asset => asset.name),
    [assets.characters]
  );
  const effectiveSceneRefs = useMemo(
    () => assets.scenes.map(asset => asset.name),
    [assets.scenes]
  );
  const effectivePageText = page?.pageText || page?.storyText || sbPage?.text || '';
  const effectiveVisualGoal = page?.visualGoal || sbPage?.visualGoal || '';
  const isPromptGenerating = promptGeneratingPage === currentPage;

  const needsPageSync = useMemo(
    () =>
      pages.some((item, index) => {
        const storyboardPage = storyboard.pages[index];
        if (item.storyboardEdited) return false;
        const nextPageText = storyboardPage?.text || '';
        const nextVisualGoal = storyboardPage?.visualGoal || '';
        return item.storyText !== nextPageText || item.pageText !== nextPageText || item.visualGoal !== nextVisualGoal;
      }),
    [pages, storyboard.pages]
  );

  useEffect(() => {
    if (!needsPageSync) return;
    dispatch({ type: 'SYNC_PAGES_FROM_STORYBOARD' });
    triggerSave();
  }, [dispatch, needsPageSync, triggerSave]);

  const requestPromptForPage = useCallback(async (pageIndex: number) => {
    const targetPage = state.pages[pageIndex];
    const targetStoryboardPage = storyboard.pages[pageIndex];
    if (!targetPage) return null;

    clearError();
    setPromptErrorPage(null);
    setPromptGeneratingPage(pageIndex);
    const promptResult = await generatePagePrompt(
      targetPage,
      assets,
      { ...projectInfo, aspectRatio: targetPage.aspectRatio || projectInfo.aspectRatio },
      targetStoryboardPage
    );
    setPromptGeneratingPage(prev => (prev === pageIndex ? null : prev));

    if (!promptResult) {
      setPromptErrorPage(pageIndex);
      return null;
    }

    dispatch({
      type: 'UPDATE_PAGE_CONFIG',
      payload: {
        index: pageIndex,
        prompt: promptResult.prompt,
        imageRefs: promptResult.imageRefs,
        promptUserEdited: false,
      },
    });
    triggerSave();
    return promptResult;
  }, [assets, clearError, dispatch, generatePagePrompt, projectInfo, state.pages, storyboard.pages, triggerSave]);

  useEffect(() => {
    if (!page || page.prompt.trim().length > 0 || page.generating || isPromptGenerating) return;
    const autoPromptKey = [
      projectInfo.artStyle,
      page.aspectRatio || projectInfo.aspectRatio,
      effectivePageText,
      effectiveVisualGoal,
    ].join('::');
    if (autoPromptRequestedRef.current[currentPage] === autoPromptKey) return;
    autoPromptRequestedRef.current[currentPage] = autoPromptKey;
    void requestPromptForPage(currentPage);
  }, [
    currentPage,
    effectivePageText,
    effectiveVisualGoal,
    isPromptGenerating,
    page,
    projectInfo.artStyle,
    projectInfo.aspectRatio,
    requestPromptForPage,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!page) return;
    let nextPage = page;
    if (!(page.prompt || '').trim()) {
      const promptResult = await requestPromptForPage(currentPage);
      if (!promptResult) return;
      nextPage = {
        ...page,
        prompt: promptResult.prompt,
        imageRefs: promptResult.imageRefs,
        promptUserEdited: false,
      };
    }
    clearError();
    dispatch({ type: 'SET_PAGE_GENERATING', payload: { index: currentPage, generating: true } });
    const url = await generatePageImage(
      nextPage,
      assets,
      { ...projectInfo, aspectRatio: nextPage.aspectRatio || projectInfo.aspectRatio },
      sbPage
    );
    if (!url) {
      dispatch({ type: 'SET_PAGE_GENERATING', payload: { index: currentPage, generating: false } });
      return;
    }
    dispatch({ type: 'SET_PAGE_IMAGE', payload: { index: currentPage, imageUrl: url } });
    triggerSave();
  }, [assets, clearError, currentPage, dispatch, generatePageImage, page, projectInfo, requestPromptForPage, sbPage, triggerSave]);

  function handleTextChange(text: string) {
    clearError();
    setPromptErrorPage(null);
    dispatch({ type: 'UPDATE_PAGE_STORYBOARD_FIELDS', payload: { index: currentPage, pageText: text } });
    triggerSave();
  }

  function handleVisualGoalChange(visualGoal: string) {
    clearError();
    setPromptErrorPage(null);
    dispatch({ type: 'UPDATE_PAGE_STORYBOARD_FIELDS', payload: { index: currentPage, visualGoal } });
    triggerSave();
  }

  function handlePromptChange(prompt: string, imageRefs: import('@/types/picturebook').ImageRef[]) {
    setPromptErrorPage(null);
    dispatch({ type: 'UPDATE_PAGE_CONFIG', payload: { index: currentPage, prompt, imageRefs, promptUserEdited: true } });
    triggerSave();
  }

  if (!page) return null;

  const meta = pageStatusIcon(page.pageStatus);
  const StatusIcon = meta.icon;

  return (
    <div className="flex flex-col lg:flex-row h-full gap-0 min-h-0">
      <div className="w-full lg:w-36 lg:flex-shrink-0 lg:border-r lg:border-border lg:flex lg:flex-col border-b border-border">
        <div className="px-3 py-2 border-b border-border hidden lg:block">
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wide">页面列表</span>
        </div>
        <div className="lg:hidden px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-body text-muted-foreground">页面列表</span>
          <span className="text-xs font-body text-muted-foreground">{currentPage + 1} / {pages.length}</span>
        </div>
        <ScrollArea className="lg:flex-1">
          <div className="p-1.5 space-y-0.5">
            {pages.map(p => {
              const m = pageStatusIcon(p.pageStatus);
              const M = m.icon;
              return (
                <button
                  key={p.index}
                  onClick={() => setCurrentPage(p.index)}
                  className={cn(
                    'w-full flex flex-col items-start px-2.5 py-2 rounded-lg transition-smooth text-left',
                    currentPage === p.index
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <M className={cn('w-3 h-3 flex-shrink-0', m.color, p.pageStatus === 'generating' && 'animate-spin')} />
                    <span className={cn(
                      'text-sm font-body font-medium flex-1',
                      currentPage === p.index ? 'text-primary' : 'text-foreground'
                    )}>
                      第 {p.index + 1} 页
                    </span>
                  </div>
                  <span className={cn('text-[10px] font-body mt-0.5 ml-4.5', m.color)}>
                    {PAGE_STATUS_LABELS[p.pageStatus]}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 lg:border-r lg:border-border">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <h3 className="font-display text-lg text-foreground">第 {currentPage + 1} 页生成</h3>
          <Badge
            variant="secondary"
            className={cn('text-[10px] font-body gap-1', meta.color, 'bg-transparent border border-current')}
          >
            <StatusIcon className={cn('w-3 h-3', page.pageStatus === 'generating' && 'animate-spin')} />
            {PAGE_STATUS_LABELS[page.pageStatus]}
          </Badge>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">画面文字</label>
              <Textarea
                value={effectivePageText}
                onChange={e => handleTextChange(e.target.value)}
                className="font-body text-sm resize-none min-h-[80px]"
                placeholder="请输入本页呈现的文字内容，需匹配目标儿童年龄段的认知水平和文字复杂度要求"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">画面内容描述</label>
              <Textarea
                value={effectiveVisualGoal}
                onChange={e => handleVisualGoalChange(e.target.value)}
                className="font-body text-sm resize-none min-h-[120px]"
                placeholder="请输入具体、可量化、纯视觉化的画面描述：默认直接写角色名称；只有当页造型、装束、道具状态或形体有变化时再补充变化点，同时写清眼睛和嘴巴形态、姿势动作、场景物体及位置/材质、光线方向与色温、具体颜色、景别/构图/视角；不要写开心、温暖、活泼等抽象词，也不要新增第 2 步之外的角色"
              />
              <p className="text-[10px] text-muted-foreground">
                提示：角色默认继承第 2 步设定，无变化时写名称即可；只描述“看得见的东西”，不要解释角色感受。
              </p>
            </div>

            <div className="border-t border-border" />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">AI绘画提示词</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void requestPromptForPage(currentPage)}
                  disabled={isPromptGenerating}
                  className="gap-1.5 font-body text-xs"
                >
                  {isPromptGenerating ? (
                    <><Loader2 className="w-3 h-3 animate-spin" />重新生成中…</>
                  ) : (
                    <><RefreshCw className="w-3 h-3" />重新生成AI绘画提示词</>
                  )}
                </Button>
              </div>
              {error && promptErrorPage === currentPage && !isPromptGenerating && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">{getErrorMessage(error)}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void requestPromptForPage(currentPage)}
                    className="h-7 gap-1 text-[10px] border-red-200 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重试
                  </Button>
                </div>
              )}
              <PromptEditor
                value={page.prompt || ''}
                imageRefs={page.imageRefs || []}
                assets={assets}
                onChange={handlePromptChange}
                characterRefs={effectiveCharacterRefs}
                sceneRefs={effectiveSceneRefs}
                onPreviewRef={(imageUrl, alt) => setPreviewState({ open: true, imageUrl, alt })}
                placeholder="系统会结合画面风格、构图、画面内容描述和光影色调自动生成提示词，你也可以继续编辑…"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">引用角色</label>
              <div className="flex flex-wrap gap-3">
                {(page.imageRefs || []).filter(ref => ref.assetType === 'character' && ref.imageUrl).map(ref => (

                    <div key={ref.assetId} className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewState({ open: true, imageUrl: ref.imageUrl!, alt: ref.assetName })}
                        className="w-12 h-12 rounded-lg border border-border overflow-hidden hover:scale-105 transition-transform bg-muted"
                      >
                        <img
                          src={ref.imageUrl!}
                          alt={ref.assetName}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-body bg-primary text-primary-foreground border border-primary">
                        {ref.refLabel || ref.assetName}
                      </span>
                    </div>
                ))}
                {(page.imageRefs || []).filter(ref => ref.assetType === 'character').length === 0 && (
                  <span className="text-xs text-muted-foreground font-body">生成提示词后自动识别引用的角色</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">引用场景</label>
              <div className="flex flex-wrap gap-3">
                {(page.imageRefs || []).filter(ref => ref.assetType === 'scene' && ref.imageUrl).map(ref => (
                    <div key={ref.assetId} className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewState({ open: true, imageUrl: ref.imageUrl!, alt: ref.assetName })}
                        className="w-12 h-12 rounded-lg border border-border overflow-hidden hover:scale-105 transition-transform bg-muted"
                      >
                        <img
                          src={ref.imageUrl!}
                          alt={ref.assetName}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-body bg-accent text-accent-foreground border border-accent">
                        {ref.refLabel || ref.assetName}
                      </span>
                    </div>
                ))}
                {(page.imageRefs || []).filter(ref => ref.assetType === 'scene').length === 0 && (
                  <span className="text-xs text-muted-foreground font-body">生成提示词后自动识别引用的场景</span>
                )}
              </div>
            </div>

            {page.pageStatus === 'review' && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs font-body text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                此页已标记为"待复查"，建议重新生成插画
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="w-full lg:w-64 lg:flex-shrink-0 flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-sm font-body font-medium text-foreground">本页插画</span>
        </div>

        <div className="flex-1 p-4 flex flex-col gap-4">
          <div className={cn('w-full rounded-xl border border-border overflow-hidden bg-muted relative group', getAspectClass(page.aspectRatio || '16:9'))}>
            {page.generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/90 z-10">
                <div className="w-10 h-10 rounded-full gradient-hero flex items-center justify-center animate-pulse-soft">
                  <Wand2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <p className="text-xs font-body text-muted-foreground">生成中…</p>
              </div>
            )}
            {page.imageUrl && !page.generating ? (
              <>
                <img src={page.imageUrl} alt="插画" className="w-full h-full object-cover cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setPreviewState({ open: true, imageUrl: page.imageUrl!, alt: `第 ${currentPage + 1} 页插画` })} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100">
                  <Expand className="w-6 h-6 text-white drop-shadow-md" />
                </div>
              </>
            ) : !page.generating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-xs font-body text-muted-foreground/60 text-center px-4">配置完成后点击生成按钮</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="space-y-1.5">
              <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">画面比例</label>
              <Select
                value={page.aspectRatio || '16:9'}
                onValueChange={(value: AspectRatio) => {
                  dispatch({
                    type: 'UPDATE_PAGE_CONFIG',
                    payload: {
                      index: currentPage,
                      aspectRatio: value,
                    },
                  });
                  triggerSave();
                }}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="选择画面比例" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3:4">3:4 (竖版)</SelectItem>
                  <SelectItem value="16:9">16:9 (横版)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={page.generating}
              className="w-full gap-2 font-body text-sm gradient-hero text-primary-foreground border-0"
            >
              {page.generating
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成中…</>
                : page.imageUrl
                ? <><RefreshCw className="w-3.5 h-3.5" />重新生成当前页</>
                : <><Wand2 className="w-3.5 h-3.5" />生成当前页插画</>
              }
            </Button>

            {page.imageUrl && (
              <Button
                onClick={() => router.push(`/editor?page=${currentPage}`)}
                variant="outline"
                className="w-full gap-2 font-body text-sm"
              >
                <Pencil className="w-3.5 h-3.5" />
                进入编辑页定稿
              </Button>
            )}
          </div>

          {page.pageStatus === 'finalized' && (
            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs font-body text-green-700 dark:text-green-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已在编辑页确认定稿
            </div>
          )}

          <div className="p-3 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between text-xs font-body">
              <span className="text-muted-foreground">页面生成进度</span>
              <span className="font-medium text-foreground">{generatedCount} / {pages.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-body">
              <span className="text-muted-foreground">页面定稿进度</span>
              <span className="font-medium text-foreground">{finalizedCount} / {pages.length}</span>
            </div>
            {allGenerated ? (
              <Button
                onClick={() => {
                  dispatch({ type: 'COMPLETE_STAGE', payload: 5 });
                  triggerSave();
                }}
                className="w-full gap-2 font-body text-sm"
                variant="outline"
              >
                <Pencil className="w-3.5 h-3.5" />
                进入编辑定稿与导出
              </Button>
            ) : (
              <p className="text-[11px] font-body text-muted-foreground">
                所有页面生成完成后，可统一进入编辑定稿与导出阶段。
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={previewState.open} onOpenChange={open => setPreviewState(s => ({ ...s, open }))}>
        <DialogContent className="max-w-[95vw] w-auto p-0 border-0 bg-transparent shadow-none">
          {previewState.imageUrl && (
            <img
              src={previewState.imageUrl}
              alt={previewState.alt}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

