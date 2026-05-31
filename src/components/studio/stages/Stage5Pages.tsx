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

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

type SelectedTarget = 'cover' | number;
type PreviewHistoryItem = {
  id: string;
  label: string;
  imageUrl: string;
  active: boolean;
  timestamp: number | null;
  historyIndex?: number;
};

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
  const currentImageHistory = isCoverSelected ? cover.imageHistory || [] : page?.imageHistory || [];
  const currentGenerating = isCoverSelected ? cover.generating : page?.generating || false;
  const currentStatus = isCoverSelected ? cover.status : page?.pageStatus || 'idle';
  const isPromptGenerating = promptGeneratingTarget === activeTargetKey;
  const currentAspectRatio = (isCoverSelected ? cover.aspectRatio : page?.aspectRatio) || '16:9';
  const currentImageUrl = isCoverSelected ? cover.imageUrl : page?.imageUrl || null;
  const currentPanelTitle = isCoverSelected ? '封面生成' : `第 ${currentPage + 1} 页生成`;
  const currentPreviewTitle = isCoverSelected ? '封面插画' : `第 ${currentPage + 1} 页插画`;
  const currentPreviewAlt = isCoverSelected ? '封面插画' : `第 ${currentPage + 1} 页插画`;
  const currentCharacterRefs = currentImageRefs.filter(ref => ref.assetType === 'character' && ref.imageUrl);
  const currentSceneRefs = currentImageRefs.filter(ref => ref.assetType === 'scene' && ref.imageUrl);
  const previewHistoryItems = useMemo<PreviewHistoryItem[]>(() => {
    if (!currentImageUrl) return [];
    return [
      {
        id: `${activeTargetKey}-current`,
        label: '当前版本',
        imageUrl: currentImageUrl,
        active: true,
        timestamp: null,
        historyIndex: undefined,
      },
      ...currentImageHistory.map((entry, index) => ({
        id: `${activeTargetKey}-history-${entry.timestamp}-${index}`,
        label: `历史版本 ${index + 1}`,
        imageUrl: entry.imageUrl,
        active: false,
        timestamp: entry.timestamp,
        historyIndex: index,
      })),
    ];
  }, [activeTargetKey, currentImageHistory, currentImageUrl]);

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

  function handleAspectRatioChange(value: AspectRatio) {
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
  }

  function handleSelectHistoryVersion(historyIndex: number) {
    if (isCoverSelected) {
      dispatch({ type: 'SELECT_COVER_IMAGE_FROM_HISTORY', payload: { historyIndex } });
    } else {
      dispatch({ type: 'SELECT_PAGE_IMAGE_FROM_HISTORY', payload: { index: currentPage, historyIndex } });
    }
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
          <div className="flex flex-col overflow-hidden card-ink rounded-[2rem] p-4 shadow-ink-light xl:sticky xl:top-6 xl:max-h-[calc(100vh-1.5rem)] backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center -rotate-3">
                <span className="font-display text-white text-xs">录</span>
              </div>
              <p className="text-sm font-body font-bold text-foreground">
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
                    'w-full rounded-[1.5rem] border-2 px-3 py-3 text-left transition-smooth hover-ink-blur group',
                    isCoverSelected
                      ? 'border-primary bg-primary/5 text-primary shadow-ink-light'
                      : 'border-transparent text-muted-foreground hover:border-primary/20 hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                      isCoverSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                    )}>
                      <BookOpen className={cn('h-4 w-4', cover.status === 'generating' && 'animate-spin')} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-body font-bold', isCoverSelected && 'text-foreground')}>
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
                        'w-full rounded-[1.5rem] border-2 px-3 py-3 text-left transition-smooth hover-ink-blur group',
                        isActive
                          ? 'border-primary bg-primary/5 text-primary shadow-ink-light'
                          : 'border-transparent text-muted-foreground hover:border-primary/20 hover:bg-muted/60 hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                        )}>
                          <M className={cn('h-4 w-4', p.pageStatus === 'generating' && 'animate-spin')} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-body font-bold', isActive && 'text-foreground')}>
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
          <div className="flex h-full min-h-0 flex-col gap-5 card-ink rounded-[2.5rem] p-4 shadow-ink-medium xl:flex-row">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] border-2 border-border/50 bg-background/80 backdrop-blur-sm">
              <div className="border-b-2 border-border/50 px-6 py-5 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <span className="font-display text-primary text-sm">
                      {isCoverSelected ? '封' : `第${currentPage + 1}`}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl text-foreground">
                    {currentPanelTitle}
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
                  先整理当前页面内容，再编辑 AI 绘画提示词，并在右侧查看出图结果。
                </p>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-5 px-6 py-6">
                  <section className="card-ink rounded-[2rem] p-5 shadow-ink-light">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center -rotate-3">
                        <span className="font-display text-white text-xs">文</span>
                      </div>
                      <h4 className="font-body text-sm font-bold text-foreground">
                        {isCoverSelected ? '封面信息' : '画面内容'}
                      </h4>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-body font-bold text-foreground">
                          {isCoverSelected ? '封面标题' : '画面文字'}
                        </label>
                        <Textarea
                          value={effectivePageText}
                          onChange={e => handleTextChange(e.target.value)}
                          className="ink-textarea min-h-[88px] text-sm"
                          placeholder={isCoverSelected
                            ? '请输入封面标题，可基于项目标题继续微调为更适合绘本封面的展示标题'
                            : '请输入本页呈现的文字内容，需匹配目标儿童年龄段的认知水平和文字复杂度要求'}
                        />
                      </div>

                      <div className="rounded-[1.5rem] border-2 border-border/50 bg-muted/30 p-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-body font-bold text-foreground">
                            {isCoverSelected ? '封面画面描述' : '画面内容描述'}
                          </label>
                          <Textarea
                            value={effectiveVisualGoal}
                            onChange={e => handleVisualGoalChange(e.target.value)}
                            className="ink-textarea min-h-[144px] text-sm"
                            placeholder={isCoverSelected
                              ? '请输入封面插画的主体、动作、场景、构图、光影、色彩和标题留白区域；封面只生成纯插画，不要要求直接把标题画进图里'
                              : '请输入具体、可量化、纯视觉化的画面描述：默认直接写角色名称；只有当页造型、装束、道具状态或形体有变化时再补充变化点，同时写清眼睛和嘴巴形态、姿势动作、场景物体及位置/材质、光线方向与色温、具体颜色、景别/构图/视角；不要写开心、温暖、活泼等抽象词，也不要新增第 2 步之外的角色'}
                          />
                          <p className="text-[10px] leading-5 text-muted-foreground">
                            {isCoverSelected
                              ? '封面描述同样只写“看得见的东西”，可补充主角、关键道具、场景关系、光影方向、主色调和标题留白位置。'
                              : '角色默认继承第 2 步设定，无变化时写名称即可；只描述“看得见的东西”，不要解释角色感受。'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="card-ink rounded-[2rem] p-5 shadow-ink-light border-primary/20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center -rotate-3">
                          <span className="font-display text-white text-xs">词</span>
                        </div>
                        <h4 className="font-body text-sm font-bold text-foreground">AI 绘画提示词</h4>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void (isCoverSelected ? requestPromptForCover() : requestPromptForPage(currentPage))}
                        disabled={isPromptGenerating || batchPromptGenerating}
                        className="gap-1.5 rounded-full border-primary/20 bg-primary/5 font-body text-xs text-primary hover:bg-primary/10"
                      >
                        {isPromptGenerating ? (
                          <><Loader2 className="h-3 w-3 animate-spin" />重新生成中…</>
                        ) : (
                          <><RefreshCw className="h-3 w-3" />重新生成 AI 绘画提示词</>
                        )}
                      </Button>
                    </div>

                    {error && promptErrorTarget === activeTargetKey && !isPromptGenerating && (
                      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">{getErrorMessage(error)}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void (isCoverSelected ? requestPromptForCover() : requestPromptForPage(currentPage))}
                          className="h-7 gap-1 rounded-full border-red-200 text-[10px] text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50"
                        >
                          <RefreshCw className="h-3 w-3" />
                          重试
                        </Button>
                      </div>
                    )}

                    <div className="rounded-[1.5rem] border-2 border-border/50 bg-background/80 p-3">
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
                  </section>

                  <section className="card-ink rounded-[2rem] p-5 shadow-ink-light">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center -rotate-3">
                        <span className="font-display text-white text-xs">材</span>
                      </div>
                      <h4 className="font-body text-sm font-bold text-foreground">引用素材</h4>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border-2 border-border/50 bg-muted/30 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="text-xs font-body font-bold text-foreground">引用角色</span>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-body text-primary">
                            {currentCharacterRefs.length} 个
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {currentCharacterRefs.map(ref => (
                            <button
                              key={ref.assetId}
                              type="button"
                              onClick={() => setPreviewState({ open: true, imageUrl: ref.imageUrl!, alt: ref.assetName })}
                              className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
                            >
                              <span className="h-12 w-12 overflow-hidden rounded-xl border border-border/60 bg-muted">
                                <img src={ref.imageUrl!} alt={ref.assetName} className="h-full w-full object-cover" />
                              </span>
                              <span className="space-y-1">
                                <span className="block text-xs font-body font-medium text-foreground">
                                  {ref.refLabel || ref.assetName}
                                </span>
                                <span className="block text-[10px] font-body text-muted-foreground">点击查看素材图</span>
                              </span>
                            </button>
                          ))}
                          {currentCharacterRefs.length === 0 && (
                            <span className="rounded-2xl border border-dashed border-border/80 bg-background/70 px-3 py-2 text-xs font-body text-muted-foreground">
                              生成提示词后自动识别引用的角色
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border-2 border-border/50 bg-muted/30 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="text-xs font-body font-bold text-foreground">引用场景</span>
                          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-body text-accent-foreground">
                            {currentSceneRefs.length} 个
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {currentSceneRefs.map(ref => (
                            <button
                              key={ref.assetId}
                              type="button"
                              onClick={() => setPreviewState({ open: true, imageUrl: ref.imageUrl!, alt: ref.assetName })}
                              className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-sm"
                            >
                              <span className="h-12 w-12 overflow-hidden rounded-xl border border-border/60 bg-muted">
                                <img src={ref.imageUrl!} alt={ref.assetName} className="h-full w-full object-cover" />
                              </span>
                              <span className="space-y-1">
                                <span className="block text-xs font-body font-medium text-foreground">
                                  {ref.refLabel || ref.assetName}
                                </span>
                                <span className="block text-[10px] font-body text-muted-foreground">点击查看场景图</span>
                              </span>
                            </button>
                          ))}
                          {currentSceneRefs.length === 0 && (
                            <span className="rounded-2xl border border-dashed border-border/80 bg-background/70 px-3 py-2 text-xs font-body text-muted-foreground">
                              生成提示词后自动识别引用的场景
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {currentStatus === 'review' && (
                    <div className="flex items-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-body text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {isCoverSelected ? '封面已标记为"待复查"，建议重新生成插画' : '此页已标记为"待复查"，建议重新生成插画'}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <aside className="flex w-full flex-shrink-0 flex-col xl:w-[440px] min-h-0">
              <ScrollArea className="h-full pr-3 -mr-3">
                <div className="flex flex-col gap-4 pb-2">
                  <div className="card-ink rounded-[2rem] p-4 shadow-ink-light">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center -rotate-3">
                      <span className="font-display text-white text-xs">览</span>
                    </div>
                    <h4 className="text-sm font-body font-bold text-foreground">{currentPreviewTitle}</h4>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn('gap-1 border border-current bg-transparent text-[10px] font-body', meta.color)}
                  >
                    <StatusIcon className={cn('h-3 w-3', currentGenerating && 'animate-spin')} />
                    {PAGE_STATUS_LABELS[currentStatus]}
                  </Badge>
                </div>

                <div className={cn('group relative w-full overflow-hidden rounded-[2rem] border-2 border-dashed border-border/80 bg-muted/50', getAspectClass(currentAspectRatio))}>
                  <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
                    <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-body text-white">
                      {isCoverSelected ? '封面' : `第 ${currentPage + 1} 页`}
                    </span>
                    <span className="rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-body text-white/90">
                      比例 {currentAspectRatio}
                    </span>
                  </div>

                  {currentGenerating && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/85 px-4 backdrop-blur-sm">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-hero animate-pulse-soft">
                        <Wand2 className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="space-y-1 text-center">
                        <p className="text-sm font-body font-medium text-foreground">正在生成插画</p>
                        <p className="text-xs font-body text-muted-foreground">可以继续微调提示词，生成完成后会显示在这里</p>
                      </div>
                    </div>
                  )}

                  {currentImageUrl && !currentGenerating ? (
                    <>
                      <img
                        src={currentImageUrl}
                        alt={currentPreviewAlt}
                        className="h-full w-full cursor-pointer object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        onClick={() => setPreviewState({
                          open: true,
                          imageUrl: currentImageUrl,
                          alt: currentPreviewAlt,
                        })}
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/15 group-hover:opacity-100">
                        <div className="rounded-full bg-black/55 p-3">
                          <Expand className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </>
                  ) : !currentGenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background/80 shadow-sm">
                        <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-body font-medium text-foreground">还没有预览图</p>
                        <p className="text-xs font-body leading-5 text-muted-foreground">
                          完成内容输入和提示词确认后，可在预览框下方直接生成当前插画。
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 rounded-[1.5rem] border-2 border-border/50 bg-background/80 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="min-w-0 flex-1">
                      <Select value={currentAspectRatio} onValueChange={handleAspectRatioChange}>
                        <SelectTrigger className="h-10 w-full rounded-xl border-2 border-border/70 bg-card text-sm font-body">
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
                      className="h-10 min-w-[160px] gap-2 rounded-xl border-0 font-body text-sm btn-ink"
                    >
                      {currentGenerating
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />生成中…</>
                        : currentImageUrl
                        ? <><RefreshCw className="h-3.5 w-3.5" />{isCoverSelected ? '重新生成封面' : '重新生成当前页'}</>
                        : <><Wand2 className="h-3.5 w-3.5" />{isCoverSelected ? '生成封面插画' : '生成当前页插画'}</>
                      }
                    </Button>
                  </div>
                </div>
              </div>

              <div className="card-ink rounded-[2rem] p-4 shadow-ink-light">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center -rotate-3">
                      <span className="font-display text-white text-xs">史</span>
                    </div>
                    <h4 className="text-sm font-body font-bold text-foreground">图片历史</h4>
                  </div>
                  <span className="text-[11px] font-body text-muted-foreground">
                    {previewHistoryItems.length > 0 ? `${previewHistoryItems.length} 条` : '待生成'}
                  </span>
                </div>

                {previewHistoryItems.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {previewHistoryItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.active) {
                            setPreviewState({ open: true, imageUrl: item.imageUrl, alt: currentPreviewAlt });
                            return;
                          }
                          if (typeof item.historyIndex === 'number') {
                            handleSelectHistoryVersion(item.historyIndex);
                          }
                        }}
                        className={cn(
                          'group min-w-[104px] rounded-2xl border-2 bg-background/80 p-2 text-left transition-all hover-ink-blur',
                          item.active ? 'border-primary shadow-ink-light' : 'border-transparent hover:border-primary/40'
                        )}
                      >
                        <div className={cn('overflow-hidden rounded-xl bg-muted', getAspectClass(currentAspectRatio))}>
                          <img
                            src={item.imageUrl}
                            alt={item.label}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-body font-medium text-foreground">{item.label}</p>
                          <p className="text-[10px] font-body text-muted-foreground">
                            {item.active
                              ? '点击查看大图'
                              : item.timestamp
                              ? `${formatTimestamp(item.timestamp)} · 点击切换为当前`
                              : '点击切换为当前'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-5 text-center">
                    <p className="text-xs font-body text-muted-foreground">
                      当前还没有历史版本；再次生成后，旧图会自动收纳到这里。
                    </p>
                  </div>
                )}
              </div>

              <div className="card-ink rounded-[2rem] p-4 shadow-ink-light">
                <div className="mb-4 flex items-center gap-2">
                  <div className="seal-pattern w-6 h-6 rounded flex items-center justify-center -rotate-3">
                    <span className="font-display text-white text-xs">修</span>
                  </div>
                  <h4 className="text-sm font-body font-bold text-foreground">编辑与定稿</h4>
                </div>

                <div className="space-y-4">
                  {!isCoverSelected && page?.imageUrl && (
                    <Button
                      onClick={() => router.push(`/editor?page=${currentPage}`)}
                      variant="outline"
                      className="w-full gap-2 rounded-2xl font-body text-sm"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      进入编辑页定稿
                    </Button>
                  )}

                  {isCoverSelected && (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-3 text-xs font-body text-muted-foreground">
                      封面无需进入编辑页，确认出图满意后可继续下一阶段。
                    </div>
                  )}
                </div>
              </div>

              {!isCoverSelected && page?.pageStatus === 'finalized' && (
                <div className="flex items-center gap-1.5 rounded-2xl border border-green-200 bg-green-50 p-3 text-xs font-body text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  已在编辑页确认定稿
                </div>
              )}

              <div className="card-ink rounded-[2rem] border-2 border-border/50 bg-card/70 p-4 shadow-ink-light backdrop-blur-sm">
                <div className="space-y-3">
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
                    <div className="rounded-2xl bg-green-50 px-3 py-2 text-[11px] font-body text-green-700 dark:bg-green-950/30 dark:text-green-300">
                      已满足进入下一阶段条件，可从顶部操作区继续。
                    </div>
                  ) : (
                    <p className="text-[11px] font-body leading-5 text-muted-foreground">
                      封面和所有正文页生成完成后，可统一进入编辑定稿与导出阶段。
                    </p>
                  )}
                </div>
              </div>
                </div>
              </ScrollArea>
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

