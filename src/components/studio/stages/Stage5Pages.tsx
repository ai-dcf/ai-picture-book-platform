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
import StageActionHeader from '@/components/studio/StageActionHeader';
import PromptEditor from '@/components/studio/PromptEditor';
import { cn } from '@/lib/utils';
import { PageStatus, PAGE_STATUS_LABELS, AspectRatio } from '@/types/picturebook';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
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

type SelectedTarget = 'cover' | number;

export default function Stage5Pages() {
  const { state, dispatch, triggerSave } = useStudio();
  const { generatePageImage, generatePagePrompt, generateBatchPagePrompts, error, clearError, getErrorMessage } = useStudioGenerate();
  const router = useRouter();
  const { pages, storyboard, assets, projectInfo, cover } = state;
  const [currentTarget, setCurrentTarget] = useState<SelectedTarget>('cover');
  const [previewState, setPreviewState] = useState<{ open: boolean; imageUrl: string; alt: string }>({ open: false, imageUrl: '', alt: '' });
  const [promptGeneratingTarget, setPromptGeneratingTarget] = useState<string | null>(null);
  const [promptErrorTarget, setPromptErrorTarget] = useState<string | null>(null);
  const [batchPromptGenerating, setBatchPromptGenerating] = useState(false);
  const [headerRegenerating, setHeaderRegenerating] = useState(false);
  const [bulkImageGenerating, setBulkImageGenerating] = useState(false);
  const autoPromptRequestedRef = useRef<Record<string, string>>({});
  const batchPromptTriggeredRef = useRef(false);
  const mountedRef = useRef(true);
  const batchPromptRequestIdRef = useRef(0);
  const generatedCount = pages.filter(item => Boolean(item.imageUrl)).length;
  const allPageGenerated = pages.length > 0 && pages.every(item => Boolean(item.imageUrl));
  const allGenerated = allPageGenerated && Boolean(cover.imageUrl);
  const finalizedCount = pages.filter(item => item.pageStatus === 'finalized').length;
  const isCoverSelected = currentTarget === 'cover';
  const currentPage = typeof currentTarget === 'number' ? currentTarget : -1;
  const page = currentPage >= 0 ? pages[currentPage] : null;
  const sbPage = currentPage >= 0 ? storyboard.pages[currentPage] : undefined;
  const activeTargetKey = isCoverSelected ? 'cover' : `page:${currentPage}`;
  const effectiveCharacterRefs = useMemo(
    () => assets.characters.map(asset => asset.name),
    [assets.characters]
  );
  const effectiveSceneRefs = useMemo(
    () => assets.scenes.map(asset => asset.name),
    [assets.scenes]
  );
  const effectivePageText = isCoverSelected
    ? cover.title || projectInfo.title || ''
    : page?.pageText || page?.storyText || sbPage?.text || '';
  const effectiveVisualGoal = isCoverSelected
    ? cover.visualGoal || ''
    : page?.visualGoal || sbPage?.visualGoal || '';
  const currentPrompt = isCoverSelected ? cover.prompt || '' : page?.prompt || '';
  const currentImageRefs = isCoverSelected ? cover.imageRefs || [] : page?.imageRefs || [];
  const currentGenerating = isCoverSelected ? cover.generating : page?.generating || false;
  const currentStatus = isCoverSelected ? cover.status : page?.pageStatus || 'idle';
  const isPromptGenerating = promptGeneratingTarget === activeTargetKey;

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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!needsPageSync) return;
    dispatch({ type: 'SYNC_PAGES_FROM_STORYBOARD' });
    triggerSave();
  }, [dispatch, needsPageSync, triggerSave]);

  useEffect(() => {
    if (batchPromptTriggeredRef.current) return;
    if (pages.length === 0) return;

    const targets = pages.filter(item => !(item.prompt || '').trim() && !item.promptUserEdited);
    if (targets.length === 0) return;

    batchPromptTriggeredRef.current = true;
    void (async () => {
      const requestId = ++batchPromptRequestIdRef.current;
      setBatchPromptGenerating(true);
      try {
        const promptResults = await generateBatchPagePrompts(
          targets.map(p => ({
            index: p.index,
            storyText: p.storyText,
            pageText: p.pageText,
            visualGoal: p.visualGoal,
            aspectRatio: p.aspectRatio,
          })),
          assets,
          projectInfo,
          storyboard.pages
        );

        console.info('[Stage5Pages] batch page prompts finished', {
          targetCount: targets.length,
          returnedCount: promptResults?.length || 0,
          returnedIndexes: promptResults?.map(p => p.index),
        });

        if (!mountedRef.current || batchPromptRequestIdRef.current !== requestId) return;

        if (promptResults?.length) {
          promptResults.forEach(result => {
            dispatch({
              type: 'UPDATE_PAGE_CONFIG',
              payload: {
                index: result.index,
                prompt: result.prompt,
                imageRefs: result.imageRefs,
                promptUserEdited: false,
              },
            });
          });
          triggerSave();
        }
      } finally {
        if (!mountedRef.current || batchPromptRequestIdRef.current !== requestId) return;
        setBatchPromptGenerating(false);
      }
    })();
  }, [assets, dispatch, generateBatchPagePrompts, pages, projectInfo, storyboard.pages, triggerSave]);

  useEffect(() => {
    if (typeof currentTarget === 'number' && !pages[currentTarget]) {
      setCurrentTarget('cover');
    }
  }, [currentTarget, pages]);

  const requestPromptForPage = useCallback(async (pageIndex: number) => {
    const targetPage = state.pages[pageIndex];
    const targetStoryboardPage = storyboard.pages[pageIndex];
    if (!targetPage) return null;

    clearError();
    setPromptErrorTarget(null);
    setPromptGeneratingTarget(`page:${pageIndex}`);
    const promptResult = await generatePagePrompt(
      targetPage,
      assets,
      { ...projectInfo, aspectRatio: targetPage.aspectRatio || projectInfo.aspectRatio },
      targetStoryboardPage,
      'page'
    );
    setPromptGeneratingTarget(prev => (prev === `page:${pageIndex}` ? null : prev));

    if (!promptResult) {
      setPromptErrorTarget(`page:${pageIndex}`);
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

  const requestPromptForCover = useCallback(async () => {
    clearError();
    setPromptErrorTarget(null);
    setPromptGeneratingTarget('cover');
    const promptResult = await generatePagePrompt(
      cover,
      assets,
      { ...projectInfo, aspectRatio: cover.aspectRatio || projectInfo.aspectRatio },
      undefined,
      'cover'
    );
    setPromptGeneratingTarget(prev => (prev === 'cover' ? null : prev));

    if (!promptResult) {
      setPromptErrorTarget('cover');
      return null;
    }

    dispatch({
      type: 'UPDATE_COVER_CONFIG',
      payload: {
        prompt: promptResult.prompt,
        imageRefs: promptResult.imageRefs,
        promptUserEdited: false,
      },
    });
    triggerSave();
    return promptResult;
  }, [assets, clearError, cover, dispatch, generatePagePrompt, projectInfo, triggerSave]);

  useEffect(() => {
    if (isCoverSelected) {
      if (cover.prompt.trim().length > 0 || cover.generating || isPromptGenerating) return;
      if (!(cover.title.trim().length > 0 || cover.visualGoal.trim().length > 0)) return;
      const autoPromptKey = [
        projectInfo.artStyle,
        cover.aspectRatio || projectInfo.aspectRatio,
        cover.title,
        cover.visualGoal,
      ].join('::');
      if (autoPromptRequestedRef.current.cover === autoPromptKey) return;
      autoPromptRequestedRef.current.cover = autoPromptKey;
      void requestPromptForCover();
      return;
    }

    if (batchPromptGenerating) return;
    if (!page || page.prompt.trim().length > 0 || page.generating || isPromptGenerating) return;
    const autoPromptKey = [
      projectInfo.artStyle,
      page.aspectRatio || projectInfo.aspectRatio,
      effectivePageText,
      effectiveVisualGoal,
    ].join('::');
    const cacheKey = `page:${currentPage}`;
    if (autoPromptRequestedRef.current[cacheKey] === autoPromptKey) return;
    autoPromptRequestedRef.current[cacheKey] = autoPromptKey;
    void requestPromptForPage(currentPage);
  }, [
    cover,
    currentPage,
    effectivePageText,
    effectiveVisualGoal,
    batchPromptGenerating,
    isPromptGenerating,
    isCoverSelected,
    page,
    projectInfo.artStyle,
    projectInfo.aspectRatio,
    requestPromptForCover,
    requestPromptForPage,
  ]);

  const handleGenerate = useCallback(async () => {
    if (isCoverSelected) {
      let nextCover = cover;
      if (!(cover.prompt || '').trim()) {
        const promptResult = await requestPromptForCover();
        if (!promptResult) return;
        nextCover = {
          ...cover,
          prompt: promptResult.prompt,
          imageRefs: promptResult.imageRefs,
          promptUserEdited: false,
        };
      }
      clearError();
      dispatch({ type: 'SET_COVER_GENERATING', payload: true });
      const url = await generatePageImage(
        nextCover,
        assets,
        { ...projectInfo, aspectRatio: nextCover.aspectRatio || projectInfo.aspectRatio },
        undefined,
        'cover'
      );
      if (!url) {
        dispatch({ type: 'SET_COVER_GENERATING', payload: false });
        return;
      }
      dispatch({ type: 'SET_COVER_IMAGE', payload: { imageUrl: url } });
      triggerSave();
      return;
    }

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
      sbPage,
      'page'
    );
    if (!url) {
      dispatch({ type: 'SET_PAGE_GENERATING', payload: { index: currentPage, generating: false } });
      return;
    }
    dispatch({ type: 'SET_PAGE_IMAGE', payload: { index: currentPage, imageUrl: url } });
    triggerSave();
  }, [assets, clearError, cover, currentPage, dispatch, generatePageImage, isCoverSelected, page, projectInfo, requestPromptForCover, requestPromptForPage, sbPage, triggerSave]);

  const handleRegenerateAll = useCallback(async () => {
    clearError();
    setPromptErrorTarget(null);
    setHeaderRegenerating(true);

    try {
      const coverPromptResult = await generatePagePrompt(
        cover,
        assets,
        { ...projectInfo, aspectRatio: cover.aspectRatio || projectInfo.aspectRatio },
        undefined,
        'cover'
      );

      if (coverPromptResult) {
        dispatch({
          type: 'UPDATE_COVER_CONFIG',
          payload: {
            prompt: coverPromptResult.prompt,
            imageRefs: coverPromptResult.imageRefs,
            promptUserEdited: false,
          },
        });
      }

      const promptResults = await generateBatchPagePrompts(
        pages.map(p => ({
          index: p.index,
          storyText: p.storyText,
          pageText: p.pageText,
          visualGoal: p.visualGoal,
          aspectRatio: p.aspectRatio,
        })),
        assets,
        projectInfo,
        storyboard.pages
      );

      if (promptResults?.length) {
        promptResults.forEach(result => {
          dispatch({
            type: 'UPDATE_PAGE_CONFIG',
            payload: {
              index: result.index,
              prompt: result.prompt,
              imageRefs: result.imageRefs,
              promptUserEdited: false,
            },
          });
        });
      }

      triggerSave();
    } finally {
      setHeaderRegenerating(false);
    }
  }, [assets, clearError, cover, dispatch, generateBatchPagePrompts, generatePagePrompt, pages, projectInfo, storyboard.pages, triggerSave]);

  const handleGenerateAllImages = useCallback(async () => {
    clearError();
    setPromptErrorTarget(null);
    setBulkImageGenerating(true);

    try {
      let nextCover = cover;

      if (!(nextCover.prompt || '').trim()) {
        const promptResult = await generatePagePrompt(
          cover,
          assets,
          { ...projectInfo, aspectRatio: cover.aspectRatio || projectInfo.aspectRatio },
          undefined,
          'cover'
        );

        if (promptResult) {
          dispatch({
            type: 'UPDATE_COVER_CONFIG',
            payload: {
              prompt: promptResult.prompt,
              imageRefs: promptResult.imageRefs,
              promptUserEdited: false,
            },
          });
          nextCover = {
            ...cover,
            prompt: promptResult.prompt,
            imageRefs: promptResult.imageRefs,
            promptUserEdited: false,
          };
        }
      }

      if ((nextCover.prompt || '').trim()) {
        dispatch({ type: 'SET_COVER_GENERATING', payload: true });
        const coverUrl = await generatePageImage(
          nextCover,
          assets,
          { ...projectInfo, aspectRatio: nextCover.aspectRatio || projectInfo.aspectRatio },
          undefined,
          'cover'
        );

        if (coverUrl) {
          dispatch({ type: 'SET_COVER_IMAGE', payload: { imageUrl: coverUrl } });
        } else {
          dispatch({ type: 'SET_COVER_GENERATING', payload: false });
        }
      }

      const missingPromptPages = pages.filter(item => !(item.prompt || '').trim());
      const promptMap = new Map<number, { prompt: string; imageRefs: import('@/types/picturebook').ImageRef[] }>();

      if (missingPromptPages.length > 0) {
        const promptResults = await generateBatchPagePrompts(
          missingPromptPages.map(p => ({
            index: p.index,
            storyText: p.storyText,
            pageText: p.pageText,
            visualGoal: p.visualGoal,
            aspectRatio: p.aspectRatio,
          })),
          assets,
          projectInfo,
          storyboard.pages
        );

        if (promptResults?.length) {
          promptResults.forEach(result => {
            promptMap.set(result.index, {
              prompt: result.prompt,
              imageRefs: result.imageRefs,
            });
            dispatch({
              type: 'UPDATE_PAGE_CONFIG',
              payload: {
                index: result.index,
                prompt: result.prompt,
                imageRefs: result.imageRefs,
                promptUserEdited: false,
              },
            });
          });
        }
      }

      for (const targetPage of pages) {
        const promptPayload = promptMap.get(targetPage.index);
        const nextPage = {
          ...targetPage,
          prompt: targetPage.prompt || promptPayload?.prompt || '',
          imageRefs: targetPage.imageRefs?.length ? targetPage.imageRefs : (promptPayload?.imageRefs || []),
        };

        if (!(nextPage.prompt || '').trim()) continue;

        dispatch({ type: 'SET_PAGE_GENERATING', payload: { index: targetPage.index, generating: true } });
        const url = await generatePageImage(
          nextPage,
          assets,
          { ...projectInfo, aspectRatio: nextPage.aspectRatio || projectInfo.aspectRatio },
          storyboard.pages[targetPage.index],
          'page'
        );

        if (url) {
          dispatch({ type: 'SET_PAGE_IMAGE', payload: { index: targetPage.index, imageUrl: url } });
        } else {
          dispatch({ type: 'SET_PAGE_GENERATING', payload: { index: targetPage.index, generating: false } });
        }
      }

      triggerSave();
    } finally {
      setBulkImageGenerating(false);
    }
  }, [assets, clearError, cover, dispatch, generateBatchPagePrompts, generatePageImage, generatePagePrompt, pages, projectInfo, storyboard.pages, triggerSave]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'COMPLETE_STAGE', payload: 4 });
    triggerSave();
  }, [dispatch, triggerSave]);

  function handleTextChange(text: string) {
    if (isCoverSelected) {
      clearError();
      setPromptErrorTarget(null);
      dispatch({ type: 'UPDATE_COVER_STORYBOARD_FIELDS', payload: { title: text } });
      triggerSave();
      return;
    }
    clearError();
    setPromptErrorTarget(null);
    dispatch({ type: 'UPDATE_PAGE_STORYBOARD_FIELDS', payload: { index: currentPage, pageText: text } });
    triggerSave();
  }

  function handleVisualGoalChange(visualGoal: string) {
    clearError();
    setPromptErrorTarget(null);
    if (isCoverSelected) {
      dispatch({ type: 'UPDATE_COVER_STORYBOARD_FIELDS', payload: { visualGoal } });
      triggerSave();
      return;
    }
    dispatch({ type: 'UPDATE_PAGE_STORYBOARD_FIELDS', payload: { index: currentPage, visualGoal } });
    triggerSave();
  }

  function handlePromptChange(prompt: string, imageRefs: import('@/types/picturebook').ImageRef[]) {
    setPromptErrorTarget(null);
    if (isCoverSelected) {
      dispatch({ type: 'UPDATE_COVER_CONFIG', payload: { prompt, imageRefs, promptUserEdited: true } });
      triggerSave();
      return;
    }
    dispatch({ type: 'UPDATE_PAGE_CONFIG', payload: { index: currentPage, prompt, imageRefs, promptUserEdited: true } });
    triggerSave();
  }

  if (!isCoverSelected && !page) return null;

  const meta = pageStatusIcon(currentStatus);
  const coverMeta = pageStatusIcon(cover.status);
  const StatusIcon = meta.icon;

  const anyPageGenerating = cover.generating || pages.some(item => item.generating);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <StageActionHeader
        title="逐页生成"
        description="逐页编辑封面与正文页的文字、提示词和插画内容；完成全部图片生成后进入编辑定稿。"
        onRegenerate={() => {
          void handleRegenerateAll();
        }}
        onNext={handleNext}
        regenerateDisabled={batchPromptGenerating || headerRegenerating || bulkImageGenerating || anyPageGenerating || pages.length === 0}
        regenerating={batchPromptGenerating || headerRegenerating}
        nextDisabled={!allGenerated}
        extraActions={(
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void handleGenerateAllImages();
            }}
            disabled={batchPromptGenerating || headerRegenerating || bulkImageGenerating || anyPageGenerating || pages.length === 0}
            className="gap-2 font-body bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
          >
            {bulkImageGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {bulkImageGenerating ? '生成中…' : '生成全部图片'}
          </Button>
        )}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
        <aside className="w-full flex-shrink-0 xl:w-64">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/90 p-4 shadow-card xl:sticky xl:top-6 xl:max-h-[calc(100vh-1.5rem)]">
            <div className="mb-4">
              <p className="text-[11px] font-body font-medium uppercase tracking-[0.18em] text-muted-foreground">
                页面目录
              </p>

            </div>

            <div className="mb-4 rounded-xl bg-muted/50 px-3 py-2 text-xs font-body text-muted-foreground">
              当前选中：
              <span className="ml-1 font-medium text-foreground">
                {isCoverSelected ? '封面' : `第 ${currentPage + 1} 页`}
              </span>
            </div>

            <div className="max-h-[420px] overflow-y-auto pr-1 xl:max-h-[calc(100vh-220px)]">
              <nav className="space-y-1.5">
                <button
                  onClick={() => setCurrentTarget('cover')}
                  className={cn(
                    'w-full rounded-xl border px-3 py-3 text-left transition-smooth',
                    isCoverSelected
                      ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      isCoverSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      <BookOpen className={cn('h-4 w-4', cover.status === 'generating' && 'animate-spin')} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-body font-medium', isCoverSelected && 'text-foreground')}>
                        封面
                      </p>
                      <p className={cn('text-[11px] font-body', coverMeta.color)}>
                        {PAGE_STATUS_LABELS[cover.status]}
                      </p>
                    </div>
                  </div>
                </button>

                {pages.map(p => {
                  const m = pageStatusIcon(p.pageStatus);
                  const M = m.icon;
                  const isActive = currentTarget === p.index;

                  return (
                    <button
                      key={p.index}
                      onClick={() => setCurrentTarget(p.index)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-3 text-left transition-smooth',
                        isActive
                          ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                          : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg',
                          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        )}>
                          <M className={cn('h-4 w-4', p.pageStatus === 'generating' && 'animate-spin')} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-body font-medium', isActive && 'text-foreground')}>
                            第 {p.index + 1} 页
                          </p>
                          <p className={cn('text-[11px] font-body', m.color)}>
                            {PAGE_STATUS_LABELS[p.pageStatus]}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col xl:flex-row">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="px-6 pt-6 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg text-foreground">
                    {isCoverSelected ? '封面生成' : `第 ${currentPage + 1} 页生成`}
                  </h3>
                  <Badge
                    variant="secondary"
                    className={cn('gap-1 border border-current bg-transparent text-[10px] font-body', meta.color)}
                  >
                    <StatusIcon className={cn('h-3 w-3', currentGenerating && 'animate-spin')} />
                    {PAGE_STATUS_LABELS[currentStatus]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs font-body text-muted-foreground">
                  先编辑当前页面的文字与画面描述，再确认 AI 绘画提示词和引用素材，最后在右侧完成出图与定稿衔接。
                </p>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-5 px-6 pb-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-body font-medium uppercase tracking-wide text-foreground">
                      {isCoverSelected ? '封面标题' : '画面文字'}
                    </label>
                    <Textarea
                      value={effectivePageText}
                      onChange={e => handleTextChange(e.target.value)}
                      className="min-h-[80px] resize-none font-body text-sm"
                      placeholder={isCoverSelected
                        ? '请输入封面标题，可基于项目标题继续微调为更适合绘本封面的展示标题'
                        : '请输入本页呈现的文字内容，需匹配目标儿童年龄段的认知水平和文字复杂度要求'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-body font-medium uppercase tracking-wide text-foreground">
                      {isCoverSelected ? '封面画面描述' : '画面内容描述'}
                    </label>
                    <Textarea
                      value={effectiveVisualGoal}
                      onChange={e => handleVisualGoalChange(e.target.value)}
                      className="min-h-[120px] resize-none font-body text-sm"
                      placeholder={isCoverSelected
                        ? '请输入封面插画的主体、动作、场景、构图、光影、色彩和标题留白区域；封面只生成纯插画，不要要求直接把标题画进图里'
                        : '请输入具体、可量化、纯视觉化的画面描述：默认直接写角色名称；只有当页造型、装束、道具状态或形体有变化时再补充变化点，同时写清眼睛和嘴巴形态、姿势动作、场景物体及位置/材质、光线方向与色温、具体颜色、景别/构图/视角；不要写开心、温暖、活泼等抽象词，也不要新增第 2 步之外的角色'}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {isCoverSelected
                        ? '提示：封面描述同样只写“看得见的东西”，可补充主角、关键道具、场景关系、光影方向、主色调和标题留白位置。'
                        : '提示：角色默认继承第 2 步设定，无变化时写名称即可；只描述“看得见的东西”，不要解释角色感受。'}
                    </p>
                  </div>

                  <div className="border-t border-border" />

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="text-xs font-body font-medium uppercase tracking-wide text-foreground">AI绘画提示词</label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void (isCoverSelected ? requestPromptForCover() : requestPromptForPage(currentPage))}
                        disabled={isPromptGenerating || batchPromptGenerating}
                        className="gap-1.5 font-body text-xs"
                      >
                        {isPromptGenerating ? (
                          <><Loader2 className="h-3 w-3 animate-spin" />重新生成中…</>
                        ) : (
                          <><RefreshCw className="h-3 w-3" />重新生成AI绘画提示词</>
                        )}
                      </Button>
                    </div>
                    {error && promptErrorTarget === activeTargetKey && !isPromptGenerating && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">{getErrorMessage(error)}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void (isCoverSelected ? requestPromptForCover() : requestPromptForPage(currentPage))}
                          className="h-7 gap-1 border-red-200 text-[10px] text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50"
                        >
                          <RefreshCw className="h-3 w-3" />
                          重试
                        </Button>
                      </div>
                    )}
                    <PromptEditor
                      value={currentPrompt}
                      imageRefs={currentImageRefs}
                      assets={assets}
                      onChange={handlePromptChange}
                      characterRefs={effectiveCharacterRefs}
                      sceneRefs={effectiveSceneRefs}
                      onPreviewRef={(imageUrl, alt) => setPreviewState({ open: true, imageUrl, alt })}
                      placeholder={isCoverSelected
                        ? '系统会结合封面标题、封面构图、画面内容描述和项目风格自动生成封面提示词，你也可以继续编辑…'
                        : '系统会结合画面风格、构图、画面内容描述和光影色调自动生成提示词，你也可以继续编辑…'}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-body font-medium uppercase tracking-wide text-foreground">引用角色</label>
                    <div className="flex flex-wrap gap-3">
                      {currentImageRefs.filter(ref => ref.assetType === 'character' && ref.imageUrl).map(ref => (
                        <div key={ref.assetId} className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewState({ open: true, imageUrl: ref.imageUrl!, alt: ref.assetName })}
                            className="h-12 w-12 overflow-hidden rounded-lg border border-border bg-muted transition-transform hover:scale-105"
                          >
                            <img
                              src={ref.imageUrl!}
                              alt={ref.assetName}
                              className="h-full w-full object-cover"
                            />
                          </button>
                          <span className="rounded-full border border-primary bg-primary px-2 py-0.5 text-[10px] font-body text-primary-foreground">
                            {ref.refLabel || ref.assetName}
                          </span>
                        </div>
                      ))}
                      {currentImageRefs.filter(ref => ref.assetType === 'character').length === 0 && (
                        <span className="text-xs font-body text-muted-foreground">生成提示词后自动识别引用的角色</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-body font-medium uppercase tracking-wide text-foreground">引用场景</label>
                    <div className="flex flex-wrap gap-3">
                      {currentImageRefs.filter(ref => ref.assetType === 'scene' && ref.imageUrl).map(ref => (
                        <div key={ref.assetId} className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewState({ open: true, imageUrl: ref.imageUrl!, alt: ref.assetName })}
                            className="h-12 w-12 overflow-hidden rounded-lg border border-border bg-muted transition-transform hover:scale-105"
                          >
                            <img
                              src={ref.imageUrl!}
                              alt={ref.assetName}
                              className="h-full w-full object-cover"
                            />
                          </button>
                          <span className="rounded-full border border-accent bg-accent px-2 py-0.5 text-[10px] font-body text-accent-foreground">
                            {ref.refLabel || ref.assetName}
                          </span>
                        </div>
                      ))}
                      {currentImageRefs.filter(ref => ref.assetType === 'scene').length === 0 && (
                        <span className="text-xs font-body text-muted-foreground">生成提示词后自动识别引用的场景</span>
                      )}
                    </div>
                  </div>

                  {currentStatus === 'review' && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs font-body text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {isCoverSelected ? '封面已标记为"待复查"，建议重新生成插画' : '此页已标记为"待复查"，建议重新生成插画'}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <aside className="flex w-full flex-shrink-0 flex-col border-t border-border bg-card/60 xl:w-[348px] xl:border-l xl:border-t-0">
              <div className="border-b border-border px-5 py-4">
                <span className="text-sm font-body font-medium text-foreground">
                  {isCoverSelected ? '封面插画' : '本页插画'}
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="space-y-4">
                  <div className={cn('relative w-full overflow-hidden rounded-xl border border-border bg-muted group', getAspectClass((isCoverSelected ? cover.aspectRatio : page?.aspectRatio) || '16:9'))}>
                    {currentGenerating && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/90">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-hero animate-pulse-soft">
                          <Wand2 className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <p className="text-xs font-body text-muted-foreground">生成中…</p>
                      </div>
                    )}
                    {(isCoverSelected ? cover.imageUrl : page?.imageUrl) && !currentGenerating ? (
                      <>
                        <img
                          src={isCoverSelected ? cover.imageUrl! : page!.imageUrl!}
                          alt={isCoverSelected ? '封面插画' : '插画'}
                          className="h-full w-full cursor-pointer object-cover transition-transform hover:scale-[1.02]"
                          onClick={() => setPreviewState({
                            open: true,
                            imageUrl: isCoverSelected ? cover.imageUrl! : page!.imageUrl!,
                            alt: isCoverSelected ? '封面插画' : `第 ${currentPage + 1} 页插画`,
                          })}
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-colors group-hover:bg-black/10 group-hover:opacity-100">
                          <Expand className="h-6 w-6 text-white drop-shadow-md" />
                        </div>
                      </>
                    ) : !currentGenerating ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                        <p className="px-4 text-center text-xs font-body text-muted-foreground/60">配置完成后点击生成按钮</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-body font-medium uppercase tracking-wide text-foreground">画面比例</label>
                      <Select
                        value={(isCoverSelected ? cover.aspectRatio : page?.aspectRatio) || '16:9'}
                        onValueChange={(value: AspectRatio) => {
                          if (isCoverSelected) {
                            dispatch({ type: 'UPDATE_COVER_CONFIG', payload: { aspectRatio: value } });
                          } else {
                            dispatch({
                              type: 'UPDATE_PAGE_CONFIG',
                              payload: {
                                index: currentPage,
                                aspectRatio: value,
                              },
                            });
                          }
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
                      disabled={currentGenerating}
                      className="w-full gap-2 border-0 font-body text-sm gradient-hero text-primary-foreground"
                    >
                      {currentGenerating
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />生成中…</>
                        : (isCoverSelected ? cover.imageUrl : page?.imageUrl)
                        ? <><RefreshCw className="h-3.5 w-3.5" />{isCoverSelected ? '重新生成封面' : '重新生成当前页'}</>
                        : <><Wand2 className="h-3.5 w-3.5" />{isCoverSelected ? '生成封面插画' : '生成当前页插画'}</>
                      }
                    </Button>

                    {!isCoverSelected && page?.imageUrl && (
                      <Button
                        onClick={() => router.push(`/editor?page=${currentPage}`)}
                        variant="outline"
                        className="w-full gap-2 font-body text-sm"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        进入编辑页定稿
                      </Button>
                    )}
                  </div>

                  {!isCoverSelected && page?.pageStatus === 'finalized' && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 p-2.5 text-xs font-body text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已在编辑页确认定稿
                    </div>
                  )}

                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-body">
                      <span className="text-muted-foreground">正文页生成进度</span>
                      <span className="font-medium text-foreground">{generatedCount} / {pages.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-body">
                      <span className="text-muted-foreground">封面状态</span>
                      <span className="font-medium text-foreground">{PAGE_STATUS_LABELS[cover.status]}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-body">
                      <span className="text-muted-foreground">页面定稿进度</span>
                      <span className="font-medium text-foreground">{finalizedCount} / {pages.length}</span>
                    </div>
                    {allGenerated ? (
                      <div className="rounded-lg bg-green-50 px-3 py-2 text-[11px] font-body text-green-700 dark:bg-green-950/30 dark:text-green-300">
                        已满足进入下一阶段条件，可从顶部操作区继续。
                      </div>
                    ) : (
                      <p className="text-[11px] font-body text-muted-foreground">
                        封面和所有正文页生成完成后，可统一进入编辑定稿与导出阶段。
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </aside>
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

