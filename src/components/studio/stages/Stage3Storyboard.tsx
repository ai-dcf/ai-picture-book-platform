"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useStudio } from '@/hooks/use-studio';
import { useStudioGenerate } from '@/hooks/use-studio-generate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  BookOpen,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Wand2,
  Users,
  MapPin,
} from 'lucide-react';
import {
  PageTurnMotivation,
  PAGE_TURN_MOTIVATION_LABELS,
  PAGE_TURN_MOTIVATIONS,
  StoryboardPageData,
} from '@/types/picturebook';

function generateMockStoryboard(
  characters: { name: string }[],
  scenes: { name: string }[],
  pageCount: number
) {
  const spreadCount = Math.ceil(pageCount / 2);
  const functions = ['建立', '触发', '发展', '发展', '高潮', '解决', '尾声'];
  const emotions = ['温馨', '好奇', '紧张', '搞笑', '震撼', '释然', '温暖'];
  const motivations: PageTurnMotivation[] = ['discovery', 'suspense', 'emotion', 'suspense', 'emotion', 'discovery'];

  const spreads = Array.from({ length: spreadCount }, (_, i) => ({
    spreadIndex: i,
    type: (i === Math.floor(spreadCount / 2) - 1 ? 'full' : 'split') as 'full' | 'split' | 'bleed',
    functionLabel: functions[Math.min(i, functions.length - 1)],
    emotionWord: emotions[Math.min(i, emotions.length - 1)],
    pageTurnMotivation: motivations[Math.min(i, motivations.length - 1)],
    pageIndices: [i * 2, i * 2 + 1 < pageCount ? i * 2 + 1 : -1].filter(v => v >= 0),
  }));

  const pages: StoryboardPageData[] = Array.from({ length: pageCount }, (_, i) => {
    const spreadIdx = Math.floor(i / 2);
    const isLeft = i % 2 === 0;
    const charPool = characters.map(c => c.name);
    const scenePool = scenes.map(s => s.name);
    const selChars = [charPool[i % charPool.length]];
    const selScenes = [scenePool[i % scenePool.length]];

    return {
      pageIndex: i,
      text: i === 0
        ? '清晨，阳光透过树叶洒在森林小路上，小兔子蹦蹦跳跳地去上学。'
        : i === pageCount - 1
        ? '夕阳西下，小兔子带着满满的收获回到家，心里暖洋洋的。'
        : `第 ${i + 1} 页：小兔子和朋友们在一起，发生了一段有趣的小故事……`,
      visualGoal: i === 0
        ? '全景：森林小路，晨光，小兔子背影'
        : i === pageCount - 1
        ? '近景：夕阳下小兔子的温暖微笑'
        : `${isLeft ? '中景' : '近景'}：${selChars[0]}在${selScenes[0]}中的画面`,
      pageTurnMotivation: motivations[Math.min(spreadIdx, motivations.length - 1)],
      characterRefs: selChars,
      sceneRefs: selScenes,
      userModified: false,
    };
  });

  return { spreads, pages };
}

export default function Stage3Storyboard() {
  const { state, dispatch, triggerSave } = useStudio();
  const { storyboard, story, projectInfo } = state;
  const { generateStoryboard, error, clearError, getErrorMessage } = useStudioGenerate();
  const [viewMode, setViewMode] = useState<'spread' | 'page'>('page');
  const [expandedPage, setExpandedPage] = useState<number | null>(0);
  const autoTriggeredRef = useRef(false);

  const handleGenerate = useCallback(async () => {
    dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: true });
    clearError();
    const result = await generateStoryboard(story, projectInfo);
    if (result) {
      dispatch({ type: 'SET_STORYBOARD', payload: { ...result, generating: false } });
      triggerSave();
    } else {
      dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: false });
    }
  }, [dispatch, story, projectInfo, generateStoryboard, clearError, triggerSave]);

  const hasStoryboardResult = useMemo(
    () =>
      storyboard.spreads.length > 0 ||
      storyboard.pages.some(
        p =>
          p.text.trim().length > 0 ||
          p.visualGoal.trim().length > 0 ||
          p.characterRefs.length > 0 ||
          p.sceneRefs.length > 0
      ),
    [storyboard.pages, storyboard.spreads]
  );

  useEffect(() => {
    const canAutoGenerate = story.characters.length > 0 && story.scenes.length > 0;

    if (
      autoTriggeredRef.current ||
      storyboard.generating ||
      hasStoryboardResult ||
      !canAutoGenerate
    ) {
      return;
    }

    autoTriggeredRef.current = true;
    void handleGenerate();
  }, [
    handleGenerate,
    hasStoryboardResult,
    storyboard.generating,
    story.characters.length,
    story.scenes.length,
  ]);

  function handleConfirm() {
    dispatch({ type: 'INIT_ASSETS' });
    dispatch({ type: 'COMPLETE_STAGE', payload: 3 });
    triggerSave();
  }

  const canConfirm = storyboard.pages.length > 0 && storyboard.pages.some(p => p.text.trim().length > 0);

  function toggleCharRef(pageIndex: number, charName: string) {
    const page = storyboard.pages[pageIndex];
    if (!page) return;
    const refs = page.characterRefs.includes(charName)
      ? page.characterRefs.filter(c => c !== charName)
      : [...page.characterRefs, charName];
    dispatch({ type: 'UPDATE_STORYBOARD_PAGE', payload: { pageIndex, data: { characterRefs: refs } } });
    triggerSave();
  }

  function toggleSceneRef(pageIndex: number, sceneName: string) {
    const page = storyboard.pages[pageIndex];
    if (!page) return;
    const refs = page.sceneRefs.includes(sceneName)
      ? page.sceneRefs.filter(s => s !== sceneName)
      : [...page.sceneRefs, sceneName];
    dispatch({ type: 'UPDATE_STORYBOARD_PAGE', payload: { pageIndex, data: { sceneRefs: refs } } });
    triggerSave();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">阶段 3 · 分镜拆页</span>
        </div>
        <h2 className="font-display text-2xl text-foreground">分镜拆页</h2>
        <p className="text-sm font-body text-muted-foreground mt-1">将故事架构转化为逐页分镜，包含正文、画面目标、翻页动力和角色/场景引用</p>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          onClick={handleGenerate}
          disabled={storyboard.generating}
          className="gap-2 font-body gradient-hero text-primary-foreground border-0"
        >
          {storyboard.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {storyboard.generating ? '生成中…' : hasStoryboardResult ? '再次手动触发分镜生成' : '整本生成分镜'}
        </Button>
        {hasStoryboardResult && (
          <Button onClick={handleGenerate} disabled={storyboard.generating} variant="outline" className="gap-2 font-body">
            <RefreshCw className="w-3.5 h-3.5" />
            重新生成
          </Button>
        )}
        {hasStoryboardResult && (
          <div className="flex gap-1 ml-auto">
            <Button
              variant={viewMode === 'spread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('spread')}
              className="font-body text-xs"
            >
              跨页视图
            </Button>
            <Button
              variant={viewMode === 'page' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('page')}
              className="font-body text-xs"
            >
              逐页视图
            </Button>
          </div>
        )}
      </div>

      {storyboard.generating && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center mx-auto animate-pulse-soft">
              <Wand2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">正在生成逐页分镜，请稍候…</p>
          </div>
        </div>
      )}

      {!storyboard.generating && hasStoryboardResult && (
        <ScrollArea className="flex-1 -mr-4 pr-4">
          {viewMode === 'spread' ? (
            <div className="space-y-4">
              {storyboard.spreads.map(spread => (
                <div key={spread.spreadIndex} className="border border-border rounded-xl p-4 bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="font-body text-xs">跨页 {spread.spreadIndex + 1}</Badge>
                    <span className="text-xs font-body text-muted-foreground">功能：{spread.functionLabel}</span>
                    <span className="text-xs font-body text-muted-foreground">情绪：{spread.emotionWord}</span>
                    <span className="text-xs font-body text-muted-foreground">
                      翻页：{PAGE_TURN_MOTIVATION_LABELS[spread.pageTurnMotivation]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {spread.pageIndices.map(pi => {
                      const page = storyboard.pages[pi];
                      if (!page) return null;
                      return (
                        <div key={pi} className="border border-border rounded-lg p-3 bg-background">
                          <p className="text-xs font-body font-medium text-foreground mb-1">第 {pi + 1} 页</p>
                          <p className="text-xs font-body text-muted-foreground line-clamp-3">{page.text}</p>
                          <p className="text-[10px] font-body text-muted-foreground mt-1">画面：{page.visualGoal}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {storyboard.pages.map(page => {
                const isExpanded = expandedPage === page.pageIndex;
                return (
                  <div key={page.pageIndex} className="border border-border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-body hover:bg-muted/50 transition-smooth"
                      onClick={() => setExpandedPage(isExpanded ? null : page.pageIndex)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">第 {page.pageIndex + 1} 页</span>
                        <Badge variant="outline" className="text-[10px] font-body">
                          {PAGE_TURN_MOTIVATION_LABELS[page.pageTurnMotivation]}
                        </Badge>
                        {page.userModified && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-body">已修改</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {page.text && (
                          <span className="text-xs text-muted-foreground max-w-[160px] truncate">{page.text}</span>
                        )}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-body font-medium text-muted-foreground">逐页正文</label>
                          <Textarea
                            value={page.text}
                            onChange={e => {
                              dispatch({ type: 'UPDATE_STORYBOARD_PAGE', payload: { pageIndex: page.pageIndex, data: { text: e.target.value } } });
                              triggerSave();
                            }}
                            className="font-body text-sm resize-none min-h-[80px]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-body font-medium text-muted-foreground">画面目标</label>
                          <Textarea
                            value={page.visualGoal}
                            onChange={e => {
                              dispatch({ type: 'UPDATE_STORYBOARD_PAGE', payload: { pageIndex: page.pageIndex, data: { visualGoal: e.target.value } } });
                              triggerSave();
                            }}
                            className="font-body text-sm resize-none min-h-[48px]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-body font-medium text-muted-foreground">翻页动力</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {PAGE_TURN_MOTIVATIONS.map(m => (
                              <button
                                key={m}
                                onClick={() => {
                                  dispatch({ type: 'UPDATE_STORYBOARD_PAGE', payload: { pageIndex: page.pageIndex, data: { pageTurnMotivation: m } } });
                                  triggerSave();
                                }}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs font-body border transition-smooth',
                                  page.pageTurnMotivation === m
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                                )}
                              >
                                {PAGE_TURN_MOTIVATION_LABELS[m]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-body font-medium text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" /> 角色引用
                          </label>
                          <div className="flex gap-1.5 flex-wrap">
                            {story.characters.map(c => (
                              <button
                                key={c.name}
                                onClick={() => toggleCharRef(page.pageIndex, c.name)}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs font-body border transition-smooth',
                                  page.characterRefs.includes(c.name)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                                )}
                              >
                                {c.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-body font-medium text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> 场景引用
                          </label>
                          <div className="flex gap-1.5 flex-wrap">
                            {story.scenes.map(s => (
                              <button
                                key={s.name}
                                onClick={() => toggleSceneRef(page.pageIndex, s.name)}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs font-body border transition-smooth',
                                  page.sceneRefs.includes(s.name)
                                    ? 'bg-accent text-accent-foreground border-accent'
                                    : 'bg-card border-border text-muted-foreground hover:border-accent/50'
                                )}
                              >
                                {s.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      )}

      {!storyboard.generating && !hasStoryboardResult && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">首次进入本阶段会自动生成分镜；如需重试，也可以手动触发生成</p>
          </div>
        </div>
      )}

      {hasStoryboardResult && !storyboard.generating && (
        <div className="pt-4 mt-auto border-t border-border flex items-center justify-between gap-4">
          <p className="text-xs font-body text-muted-foreground">确认分镜后将进入素材设定阶段，每页角色和场景引用将被固定</p>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="gap-2 font-body gradient-hero text-primary-foreground border-0"
          >
            确认分镜，进入素材设定
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
