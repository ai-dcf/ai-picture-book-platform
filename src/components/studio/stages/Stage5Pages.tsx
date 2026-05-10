"use client";
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { simulateGeneration } from '@/modules/studio/infrastructure/simulation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PageStatus, PAGE_STATUS_LABELS } from '@/types/picturebook';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Wand2,
} from 'lucide-react';
import { buildPagePrompt } from '@/modules/studio/domain/services/prompt';

function arraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

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

export default function Stage5Pages() {
  const { state, dispatch, triggerSave } = useStudio();
  const router = useRouter();
  const { pages, storyboard, assets, projectInfo } = state;
  const [currentPage, setCurrentPage] = useState(0);
  const generatedCount = pages.filter(item => Boolean(item.imageUrl)).length;
  const allGenerated = pages.length > 0 && pages.every(item => Boolean(item.imageUrl));
  const finalizedCount = pages.filter(item => item.pageStatus === 'finalized').length;

  const page = pages[currentPage];
  const sbPage = storyboard.pages[currentPage];
  const effectiveCharacterRefs = useMemo(
    () => (page?.characterRefs.length ? page.characterRefs : (sbPage?.characterRefs || [])),
    [page?.characterRefs, sbPage?.characterRefs]
  );
  const effectiveSceneRefs = useMemo(
    () => (page?.sceneRefs.length ? page.sceneRefs : (sbPage?.sceneRefs || [])),
    [page?.sceneRefs, sbPage?.sceneRefs]
  );

  const needsPageSync = useMemo(
    () =>
      pages.some((item, index) => {
        const storyboardPage = storyboard.pages[index];
        const nextStoryText =
          item.pageStatus === 'idle' && !item.storyText.trim()
            ? (storyboardPage?.text || '')
            : item.storyText;
        const nextCharacterRefs = storyboardPage?.characterRefs || item.characterRefs;
        const nextSceneRefs = storyboardPage?.sceneRefs || item.sceneRefs;
        const nextPrompt = item.promptUserEdited
          ? item.prompt
          : buildPagePrompt({
              pageIndex: index,
              page: {
                storyText: nextStoryText,
                characterRefs: nextCharacterRefs,
                sceneRefs: nextSceneRefs,
              },
              storyboardPage,
              assets,
              projectInfo,
            });

        return (
          item.storyText !== nextStoryText ||
          !arraysEqual(item.characterRefs, nextCharacterRefs) ||
          !arraysEqual(item.sceneRefs, nextSceneRefs) ||
          item.prompt !== nextPrompt
        );
      }),
    [assets, pages, projectInfo, storyboard.pages]
  );

  useEffect(() => {
    if (!needsPageSync) return;
    dispatch({ type: 'SYNC_PAGES_FROM_STORYBOARD' });
    triggerSave();
  }, [dispatch, needsPageSync, triggerSave]);

  const handleGenerate = useCallback(async () => {
    if (!page) return;
    if (!(page.prompt || '').trim()) {
      dispatch({
        type: 'UPDATE_PAGE_CONFIG',
        payload: {
          index: currentPage,
          prompt: buildPagePrompt({
            pageIndex: currentPage,
            page: {
              storyText: page.storyText,
              characterRefs: effectiveCharacterRefs,
              sceneRefs: effectiveSceneRefs,
            },
            storyboardPage: sbPage,
            assets,
            projectInfo,
          }),
        },
      });
    }
    dispatch({ type: 'SET_PAGE_GENERATING', payload: { index: currentPage, generating: true } });
    const url = await simulateGeneration(2800);
    dispatch({ type: 'SET_PAGE_IMAGE', payload: { index: currentPage, imageUrl: url } });
    triggerSave();
  }, [assets, currentPage, dispatch, effectiveCharacterRefs, effectiveSceneRefs, page, projectInfo, sbPage, triggerSave]);

  function handleTextChange(text: string) {
    dispatch({ type: 'UPDATE_PAGE_CONFIG', payload: { index: currentPage, storyText: text } });
    triggerSave();
  }

  function handlePromptChange(prompt: string) {
    dispatch({ type: 'UPDATE_PAGE_CONFIG', payload: { index: currentPage, prompt } });
    triggerSave();
  }

  if (!page) return null;

  const meta = pageStatusIcon(page.pageStatus);
  const StatusIcon = meta.icon;

  return (
    <div className="flex h-full gap-0 min-h-0">
      <div className="w-36 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-3 py-2 border-b border-border">
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wide">页面列表</span>
        </div>
        <ScrollArea className="flex-1">
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

      <div className="flex-1 flex flex-col min-w-0 min-h-0 border-r border-border">
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
              <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">本页故事文字</label>
              <Textarea
                value={page.storyText}
                onChange={e => handleTextChange(e.target.value)}
                className="font-body text-sm resize-none min-h-[80px]"
                placeholder="输入本页故事文字…"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">本页角色引用</label>
              <div className="flex flex-wrap gap-1.5">
                {assets.characters.map(c => (
                  <span
                    key={c.id}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-body border',
                      effectiveCharacterRefs.includes(c.name)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground'
                    )}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">本页场景引用</label>
              <div className="flex flex-wrap gap-1.5">
                {assets.scenes.map(s => (
                  <span
                    key={s.id}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-body border',
                      effectiveSceneRefs.includes(s.name)
                        ? 'bg-accent text-accent-foreground border-accent'
                        : 'bg-card border-border text-muted-foreground'
                    )}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-body font-medium text-foreground uppercase tracking-wide">页面生成提示词</label>
              <Textarea
                value={page.prompt || ''}
                onChange={e => handlePromptChange(e.target.value)}
                className="font-body text-sm resize-none min-h-[132px]"
                placeholder="系统会自动生成页面提示词，你也可以继续编辑镜头、光线、氛围等要求…"
              />
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

      <div className="w-64 flex-shrink-0 flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-sm font-body font-medium text-foreground">本页插画</span>
        </div>

        <div className="flex-1 p-4 flex flex-col gap-4">
          <div className="aspect-square w-full rounded-xl border border-border overflow-hidden bg-muted relative">
            {page.generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/90 z-10">
                <div className="w-10 h-10 rounded-full gradient-hero flex items-center justify-center animate-pulse-soft">
                  <Wand2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <p className="text-xs font-body text-muted-foreground">生成中…</p>
              </div>
            )}
            {page.imageUrl && !page.generating ? (
              <img src={page.imageUrl} alt="插画" className="w-full h-full object-cover" />
            ) : !page.generating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-xs font-body text-muted-foreground/60 text-center px-4">配置完成后点击生成按钮</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
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
    </div>
  );
}

