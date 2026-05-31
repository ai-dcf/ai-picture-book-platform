"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useStudioGenerate } from '@/modules/studio/presentation/hooks/use-studio-generate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import StageActionHeader from '@/components/studio/StageActionHeader';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, BookOpen, ChevronDown, ChevronUp, FileText, Loader2, MapPin, RefreshCw, Users, Wand2 } from 'lucide-react';
import { ProjectInfo, StoryEntry } from '@/types/picturebook';
import type { StoryPackCheckReport } from '@/prompts/builders/story-pack';

interface EntryCardProps {
  entry: StoryEntry;
  onDescChange: (desc: string) => void;
  colorClass: string;
}

function EntryCard({ entry, onDescChange, colorClass }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn('border-2 rounded-2xl overflow-hidden bg-background/80 backdrop-blur-sm transition-smooth hover:shadow-ink-light', colorClass)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          <span className="text-sm font-body font-bold text-foreground truncate">{entry.name}</span>
          {entry.userModified && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-body">已修改</span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4">
          <Textarea
            value={entry.description}
            onChange={e => onDescChange(e.target.value)}
            placeholder="输入描述（外貌特征、性格等）…"
            className="ink-textarea text-xs min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground font-body mt-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            修改描述可能影响后续素材设定与逐页生成
          </p>
        </div>
      )}
      {!expanded && entry.description && (
        <p className="px-4 pb-3 text-xs font-body text-muted-foreground truncate">{entry.description}</p>
      )}
    </div>
  );
}

function buildStoryPackJson(
  projectInfo: Pick<ProjectInfo, 'targetAge' | 'pageCount' | 'artStyle'>,
  story: {
    characters: StoryEntry[];
    storyOutline: string;
    scenes: StoryEntry[];
  },
  storyboard: {
    pages: {
      pageIndex: number;
      text: string;
      visualGoal: string;
      userModified: boolean;
    }[];
  },
  cover: {
    title: string;
    visualGoal: string;
  },
  rationale: string
) {
  return JSON.stringify({
    meta: {
      targetAge: projectInfo.targetAge,
      pageCount: projectInfo.pageCount,
      artStyle: projectInfo.artStyle,
      rationale,
    },
    story,
    storyboard,
    cover,
  });
}

function getOverallScore(report: StoryPackCheckReport) {
  return ((report.completenessScore + report.continuityScore + report.densityScore) / 3).toFixed(1);
}

type SectionId = 'story-outline' | 'characters' | 'scenes' | 'storyboard';

const SECTION_ITEMS = [
  { id: 'story-outline', label: '故事大纲', icon: FileText },
  { id: 'characters', label: '角色设定', icon: Users },
  { id: 'scenes', label: '场景清单', icon: MapPin },
  { id: 'storyboard', label: '分镜拆页', icon: BookOpen },
] as const satisfies ReadonlyArray<{
  id: SectionId;
  label: string;
  icon: typeof FileText;
}>;

export default function Stage2Story() {
  const { state, dispatch, triggerSave } = useStudio();
  const { story, storyboard, cover, projectInfo, stageStatuses } = state;
  const { generateStoryPack, checkStoryPack, repairStoryPack, error, clearError, getErrorMessage } = useStudioGenerate();
  const [expandedPage, setExpandedPage] = useState<number | null>(0);
  const autoStoryPackTriggeredRef = useRef(false);
  const [checkReport, setCheckReport] = useState<StoryPackCheckReport | null>(null);
  const [lastGeneratedJson, setLastGeneratedJson] = useState<string>('');
  const [lastRationale, setLastRationale] = useState<string>('');
  const [checkingReport, setCheckingReport] = useState(false);

  const runStoryPackCheck = useCallback(async (generatedJson: string, suppressFailure = false) => {
    setCheckingReport(true);
    const report = await checkStoryPack(projectInfo.title, generatedJson);
    if (report) {
      setCheckReport(report);
    } else if (suppressFailure) {
      clearError();
    }
    setCheckingReport(false);
    return report;
  }, [checkStoryPack, clearError, projectInfo.title]);

  const handleGenerateAll = useCallback(async () => {
    dispatch({ type: 'SET_STORY_GENERATING', payload: true });
    dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: true });
    dispatch({ type: 'SET_COVER_GENERATING', payload: true });
    clearError();
    try {
      setCheckReport(null);
      const result = await generateStoryPack(projectInfo, projectInfo.title);
      if (!result) {
        dispatch({ type: 'SET_STORY_GENERATING', payload: false });
        dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: false });
        dispatch({ type: 'SET_COVER_GENERATING', payload: false });
        return;
      }

      dispatch({
        type: 'SET_PROJECT_INFO',
        payload: {
          targetAge: result.meta.targetAge,
          pageCount: result.meta.pageCount,
          artStyle: result.meta.artStyle,
        },
      });
      dispatch({ type: 'SET_STORY', payload: { ...result.story, generating: false } });
      dispatch({ type: 'SET_STORYBOARD', payload: { ...result.storyboard, generating: false } });
      dispatch({
        type: 'SET_COVER',
        payload: {
          title: result.cover.title,
          visualGoal: result.cover.visualGoal,
          userModified: false,
          generating: false,
          status: result.cover.title.trim() || result.cover.visualGoal.trim() ? 'pending' : 'idle',
        },
      });

      const generatedJson = buildStoryPackJson(
        {
          targetAge: result.meta.targetAge,
          pageCount: result.meta.pageCount,
          artStyle: result.meta.artStyle,
        },
        result.story,
        result.storyboard,
        result.cover,
        result.meta.rationale || ''
      );
      setLastGeneratedJson(generatedJson);
      setLastRationale(result.meta.rationale || '');
      void runStoryPackCheck(generatedJson, true);
      triggerSave();
    } catch (err) {
      console.error('生成绘本内容失败', err);
      dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: false });
      dispatch({ type: 'SET_COVER_GENERATING', payload: false });
      dispatch({ type: 'SET_STORY_GENERATING', payload: false });
    }
  }, [clearError, dispatch, generateStoryPack, projectInfo, runStoryPackCheck, triggerSave]);

  const handleCheck = useCallback(async () => {
    clearError();
    const generatedJson = lastGeneratedJson || buildStoryPackJson(
      projectInfo,
      story,
      storyboard,
      { title: cover.title, visualGoal: cover.visualGoal },
      lastRationale || ''
    );
    setLastGeneratedJson(generatedJson);
    await runStoryPackCheck(generatedJson);
  }, [clearError, cover.title, cover.visualGoal, lastGeneratedJson, lastRationale, projectInfo, runStoryPackCheck, story, storyboard]);

  const handleRepair = useCallback(async () => {
    if (!checkReport) return;
    clearError();
    const originalJson = lastGeneratedJson || buildStoryPackJson(
      projectInfo,
      story,
      storyboard,
      { title: cover.title, visualGoal: cover.visualGoal },
      lastRationale || ''
    );
    setLastGeneratedJson(originalJson);

    dispatch({ type: 'SET_STORY_GENERATING', payload: true });
    dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: true });
    dispatch({ type: 'SET_COVER_GENERATING', payload: true });
    setCheckReport(null);

    const result = await repairStoryPack(projectInfo.title, originalJson, checkReport);
    if (!result) {
      dispatch({ type: 'SET_STORY_GENERATING', payload: false });
      dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: false });
      dispatch({ type: 'SET_COVER_GENERATING', payload: false });
      return;
    }

    dispatch({
      type: 'SET_PROJECT_INFO',
      payload: {
        targetAge: result.meta.targetAge,
        pageCount: result.meta.pageCount,
        artStyle: result.meta.artStyle,
      },
    });
    dispatch({ type: 'SET_STORY', payload: { ...result.story, generating: false } });
    dispatch({ type: 'SET_STORYBOARD', payload: { ...result.storyboard, generating: false } });
    dispatch({
      type: 'SET_COVER',
      payload: {
        title: result.cover.title,
        visualGoal: result.cover.visualGoal,
        userModified: false,
        generating: false,
        status: result.cover.title.trim() || result.cover.visualGoal.trim() ? 'pending' : 'idle',
      },
    });

    const generatedJson = buildStoryPackJson(
      {
        targetAge: result.meta.targetAge,
        pageCount: result.meta.pageCount,
        artStyle: result.meta.artStyle,
      },
      result.story,
      result.storyboard,
      result.cover,
      result.meta.rationale || ''
    );
    setLastGeneratedJson(generatedJson);
    setLastRationale(result.meta.rationale || '');
    void runStoryPackCheck(generatedJson, true);
    triggerSave();
  }, [checkReport, clearError, cover.title, cover.visualGoal, dispatch, lastGeneratedJson, lastRationale, projectInfo, repairStoryPack, runStoryPackCheck, story, storyboard, triggerSave]);

  const hasStoryResult = useMemo(
    () =>
      story.storyOutline.trim().length > 0 ||
      story.characters.length > 0 ||
      story.scenes.length > 0,
    [story]
  );

  const hasStoryboardResult = useMemo(
    () =>
      storyboard.pages.some(p => p.text.trim().length > 0 || p.visualGoal.trim().length > 0),
    [storyboard.pages]
  );
  const hasCoverResult = useMemo(
    () => cover.title.trim().length > 0 || cover.visualGoal.trim().length > 0,
    [cover.title, cover.visualGoal]
  );

  useEffect(() => {
    const hasAnyResult = hasStoryResult || hasStoryboardResult || hasCoverResult;
    const canAutoGenerate = projectInfo.title.trim().length > 0;

    if (
      autoStoryPackTriggeredRef.current ||
      story.generating ||
      storyboard.generating ||
      cover.generating ||
      hasAnyResult ||
      !canAutoGenerate
    ) {
      return;
    }

    autoStoryPackTriggeredRef.current = true;
    void handleGenerateAll();
  }, [
    cover.generating,
    handleGenerateAll,
    hasCoverResult,
    hasStoryboardResult,
    hasStoryResult,
    projectInfo.title,
    storyboard.generating,
    story.generating,
    story.characters.length,
    story.scenes.length,
    story.storyOutline,
  ]);

  function handleConfirm() {
    dispatch({ type: 'INIT_ASSETS' });
    dispatch({ type: 'COMPLETE_STAGE', payload: 2 });
    triggerSave();
  }

  const storyReady =
    story.characters.length > 0 &&
    story.storyOutline.trim().length > 0 &&
    story.scenes.length > 0;

  const storyboardReady =
    storyboard.pages.length > 0 &&
    storyboard.pages.some(p => p.text.trim().length > 0) &&
    cover.title.trim().length > 0 &&
    cover.visualGoal.trim().length > 0;

  const canConfirm = storyReady && storyboardReady;

  const hasDownstream =
    stageStatuses[3] !== 'idle' || stageStatuses[4] !== 'idle' || stageStatuses[5] !== 'idle';
  const overallScore = checkReport ? getOverallScore(checkReport) : null;
  const [activeSection, setActiveSection] = useState<SectionId>('story-outline');
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const storyOutlineRef = useRef<HTMLElement | null>(null);
  const charactersRef = useRef<HTMLElement | null>(null);
  const scenesRef = useRef<HTMLElement | null>(null);
  const storyboardRef = useRef<HTMLElement | null>(null);

  const scrollToSection = useCallback((sectionId: SectionId) => {
    const scrollContainer = contentScrollRef.current;
    const sectionEntries = {
      'story-outline': storyOutlineRef.current,
      characters: charactersRef.current,
      scenes: scenesRef.current,
      storyboard: storyboardRef.current,
    };
    const target = sectionEntries[sectionId];

    if (!scrollContainer || !target) return;

    setActiveSection(sectionId);
    scrollContainer.scrollTo({
      top: Math.max(0, target.offsetTop - 24),
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    const scrollContainer = contentScrollRef.current;
    if (!scrollContainer || story.generating || !hasStoryResult) return;

    const sections: Array<{ id: SectionId; element: HTMLElement | null }> = [
      { id: 'story-outline', element: storyOutlineRef.current },
      { id: 'characters', element: charactersRef.current },
      { id: 'scenes', element: scenesRef.current },
      { id: 'storyboard', element: storyboardRef.current },
    ];

    const updateActiveSection = () => {
      const currentTop = scrollContainer.scrollTop + 120;
      let nextActive: SectionId = 'story-outline';

      for (const section of sections) {
        if (section.element && section.element.offsetTop <= currentTop) {
          nextActive = section.id;
        }
      }

      setActiveSection(prev => (prev === nextActive ? prev : nextActive));
    };

    updateActiveSection();
    scrollContainer.addEventListener('scroll', updateActiveSection, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', updateActiveSection);
    };
  }, [hasStoryResult, story.generating, storyboard.pages.length, story.characters.length, story.scenes.length]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-primary/5 to-transparent pointer-events-none" />

      <StageActionHeader
        title="故事架构与分镜"
        description="先生成可编辑的故事结构，再将故事拆成逐页分镜与封面描述，进入后续素材设定与逐页生成流程"
        onRegenerate={handleGenerateAll}
        onNext={handleConfirm}
        regenerateDisabled={story.generating || storyboard.generating || cover.generating || checkingReport}
        regenerating={story.generating || storyboard.generating || cover.generating}
        nextDisabled={!canConfirm}
        accessory={(
          (checkingReport || checkReport) ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-body transition-smooth',
                      checkingReport && 'border-border bg-card text-muted-foreground',
                      !checkingReport && checkReport?.overallPass && 'border-green-200 bg-green-50 text-green-700 shadow-sm',
                      !checkingReport && checkReport && !checkReport.overallPass && 'border-amber-200 bg-amber-50 text-amber-700 shadow-sm'
                    )}
                  >
                    {checkingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
                    <span className="font-bold">{checkingReport ? '评分中...' : `评分 ${overallScore} / 10`}</span>
                  </button>
                </TooltipTrigger>
                {checkReport && (
                  <TooltipContent side="bottom" align="end" className="max-w-[360px] space-y-3 px-4 py-3 card-ink rounded-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-foreground">总分 {overallScore} / 10</span>
                      <span className={cn('text-xs font-bold px-2 py-1 rounded-full', checkReport.overallPass ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                        {checkReport.overallPass ? '通过' : '待修复'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground bg-background/50 rounded-lg p-2">
                      <div className="text-center">完整性 {checkReport.completenessScore}</div>
                      <div className="text-center">连续性 {checkReport.continuityScore}</div>
                      <div className="text-center">密度 {checkReport.densityScore}</div>
                    </div>
                    {checkReport.summary && (
                      <p className="text-xs leading-5 text-muted-foreground/90">{checkReport.summary}</p>
                    )}
                    <div className="space-y-2 text-xs leading-5 text-muted-foreground/90">
                      {checkReport.completenessIssues.length > 0 && (
                        <div><span className="font-bold text-foreground">完整性问题：</span>{checkReport.completenessIssues.join('；')}</div>
                      )}
                      {checkReport.continuityIssues.length > 0 && (
                        <div>
                          <span className="font-bold text-foreground">连续性问题：</span>
                          {checkReport.continuityIssues.map(i => `${i.pagePair} ${i.issue}`).join('；')}
                        </div>
                      )}
                      {checkReport.densityIssues.length > 0 && (
                        <div>
                          <span className="font-bold text-foreground">密度问题：</span>
                          {checkReport.densityIssues.map(i => `第${i.page}页 ${i.issue} 建议：${i.suggestion}`).join('；')}
                        </div>
                      )}
                      {checkReport.completenessIssues.length === 0 &&
                        checkReport.continuityIssues.length === 0 &&
                        checkReport.densityIssues.length === 0 && (
                          <div className="text-green-600 font-medium">未发现明显问题，可直接继续。</div>
                        )}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ) : null
        )}
      />

      <div className="flex min-h-0 flex-1 gap-6 relative z-10">
        <aside className="w-64 flex-shrink-0">
          <div className="sticky top-6 rounded-[2rem] card-ink p-6 shadow-ink-light">
            <div className="mb-6 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-primary rounded-full" />
              <p className="text-xs font-body font-bold uppercase tracking-[0.2em] text-foreground">
                卷宗目录
              </p>
            </div>

            <nav className="space-y-2">
              {SECTION_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-body transition-smooth',
                      isActive
                        ? 'border-primary/50 bg-primary/10 text-primary shadow-sm font-bold'
                        : 'border-transparent text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-xl shadow-sm',
                        isActive ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-hidden rounded-[2rem] card-ink shadow-ink-light relative">
          <div ref={contentScrollRef} className="h-full overflow-y-auto px-8 py-8">
            <div className="flex min-h-full flex-col">

            {error && !story.generating && !storyboard.generating && !cover.generating && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200/50 bg-red-50/50 px-5 py-4 text-sm text-red-700 backdrop-blur-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="flex-1 font-body">{getErrorMessage(error)}</span>
                <Button
                  onClick={handleGenerateAll}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 font-body text-xs h-8 border-red-200 text-red-700 hover:bg-red-100 rounded-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  重试
                </Button>
              </div>
            )}

            {story.generating && (
              <div className="flex min-h-[420px] flex-1 items-center justify-center">
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shadow-glow animate-pulse">
                    <Wand2 className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-base font-body font-medium text-muted-foreground tracking-wide">构思故事架构中…</p>
                </div>
              </div>
            )}

            {!story.generating && !hasStoryResult && (
              <div className="flex min-h-[420px] flex-1 items-center justify-center">
                <div className="max-w-md space-y-4 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-muted/50 border-2 border-border border-dashed">
                    <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-body text-muted-foreground leading-relaxed">
                    首次进入本阶段会自动生成故事架构；如需重试，也可以手动触发生成
                  </p>
                </div>
              </div>
            )}

            {!story.generating && hasStoryResult && (
              <div className="space-y-12 pb-8">
                <section ref={storyOutlineRef} id="story-outline" className="scroll-mt-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="seal-pattern w-8 h-8 rounded flex items-center justify-center -rotate-3">
                      <span className="font-display text-white text-sm">一</span>
                    </div>
                    <h3 className="text-lg font-body font-bold text-foreground tracking-wide">
                      故事大纲
                    </h3>
                  </div>
                  <Textarea
                    value={story.storyOutline}
                    onChange={e => {
                      dispatch({ type: 'SET_STORY', payload: { storyOutline: e.target.value } });
                      triggerSave();
                    }}
                    className="ink-textarea"
                    placeholder="输入故事大纲…"
                  />
                </section>

                <div className="divider-ink w-full opacity-50" />

                <section ref={charactersRef} id="characters" className="scroll-mt-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="seal-pattern w-8 h-8 rounded flex items-center justify-center rotate-2">
                      <span className="font-display text-white text-sm">二</span>
                    </div>
                    <h3 className="text-lg font-body font-bold text-foreground tracking-wide flex items-center gap-2">
                      角色设定
                      <span className="text-xs font-normal text-muted-foreground">（可编辑描述，不可新增/删除）</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {story.characters.map(c => (
                      <EntryCard
                        key={c.name}
                        entry={c}
                        colorClass="border-primary/20"
                        onDescChange={desc => {
                          dispatch({ type: 'UPDATE_CHARACTER_DESC', payload: { name: c.name, description: desc } });
                          triggerSave();
                        }}
                      />
                    ))}
                  </div>
                </section>

                <div className="divider-ink w-full opacity-50" />

                <section ref={scenesRef} id="scenes" className="scroll-mt-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="seal-pattern w-8 h-8 rounded flex items-center justify-center -rotate-2">
                      <span className="font-display text-white text-sm">三</span>
                    </div>
                    <h3 className="text-lg font-body font-bold text-foreground tracking-wide flex items-center gap-2">
                      场景清单
                      <span className="text-xs font-normal text-muted-foreground">（可编辑描述，不可新增/删除）</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {story.scenes.map(s => (
                      <EntryCard
                        key={s.name}
                        entry={s}
                        colorClass="border-accent/20"
                        onDescChange={desc => {
                          dispatch({ type: 'UPDATE_SCENE_DESC', payload: { name: s.name, description: desc } });
                          triggerSave();
                        }}
                      />
                    ))}
                  </div>
                </section>

                <div className="divider-ink w-full opacity-50" />

                <section ref={storyboardRef} id="storyboard" className="scroll-mt-8 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="seal-pattern w-8 h-8 rounded flex items-center justify-center rotate-3">
                        <span className="font-display text-white text-sm">四</span>
                      </div>
                      <h3 className="text-lg font-body font-bold text-foreground tracking-wide">
                        分镜拆页
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCheck}
                        disabled={story.generating || storyboard.generating || cover.generating || checkingReport || !(hasStoryResult || hasStoryboardResult || hasCoverResult)}
                        variant="outline"
                        className="font-body rounded-full px-5 border-2"
                      >
                        {checkingReport ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2"/> 评分中…</> : '质量检查'}
                      </Button>
                      <Button
                        onClick={handleRepair}
                        disabled={story.generating || storyboard.generating || cover.generating || !checkReport}
                        className="font-body rounded-full px-5 btn-ink border-0"
                      >
                        <Wand2 className="w-3.5 h-3.5 mr-2" />
                        一键修复
                      </Button>
                    </div>
                  </div>

                  {storyboard.generating && (
                    <div className="flex items-center justify-center py-12">
                      <div className="space-y-4 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shadow-glow animate-pulse">
                          <Wand2 className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-base font-body font-medium text-muted-foreground tracking-wide">生成逐页分镜中…</p>
                      </div>
                    </div>
                  )}

                  {!storyboard.generating && !hasStoryboardResult && !hasCoverResult && (
                    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center text-sm font-body text-muted-foreground">
                      首次进入本阶段会自动生成正文分镜和封面内容；如需重试，也可以手动触发生成
                    </div>
                  )}

                  {!storyboard.generating && (hasStoryboardResult || hasCoverResult) && (
                    <div className="space-y-4">
                      {/* Cover Setup */}
                      <div className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-background/50 shadow-sm transition-all hover:border-primary/40">
                        <div className="flex items-center justify-between border-b-2 border-primary/10 bg-primary/5 px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-foreground">封面设置</span>
                            {cover.userModified && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-body font-bold">已修改</span>
                            )}
                          </div>
                          <Button
                            onClick={handleGenerateAll}
                            disabled={story.generating || cover.generating || storyboard.generating}
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 font-body text-xs text-primary hover:bg-primary/10 rounded-full"
                          >
                            {cover.generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            {cover.generating ? '生成中…' : '重新生成'}
                          </Button>
                        </div>
                        <div className="space-y-4 px-5 py-5">
                          <div className="space-y-2">
                            <label className="text-xs font-body font-bold text-muted-foreground">封面标题</label>
                            <Textarea
                              value={cover.title}
                              onChange={e => {
                                dispatch({ type: 'UPDATE_COVER_STORYBOARD_FIELDS', payload: { title: e.target.value } });
                                triggerSave();
                              }}
                              className="ink-textarea min-h-[64px]"
                              placeholder="请输入封面标题，可基于项目标题继续微调"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-body font-bold text-muted-foreground">封面画面描述</label>
                            <Textarea
                              value={cover.visualGoal}
                              onChange={e => {
                                dispatch({ type: 'UPDATE_COVER_STORYBOARD_FIELDS', payload: { visualGoal: e.target.value } });
                                triggerSave();
                              }}
                              className="ink-textarea min-h-[120px]"
                              placeholder="请输入封面插画的主体、动作、场景、构图、光影、色彩和标题留白区域"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Pages List */}
                      {storyboard.pages.map(page => {
                        const isExpanded = expandedPage === page.pageIndex;
                        return (
                          <div key={page.pageIndex} className="overflow-hidden rounded-2xl border-2 border-border bg-background/50 transition-all hover:border-primary/30">
                            <button
                              className="flex w-full items-center justify-between px-5 py-4 text-sm font-body hover:bg-muted/50 transition-smooth"
                              onClick={() => setExpandedPage(isExpanded ? null : page.pageIndex)}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-foreground bg-primary/10 text-primary px-3 py-1 rounded-lg">第 {page.pageIndex + 1} 页</span>
                                {page.userModified && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-body font-bold">已修改</span>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                {page.text && (
                                  <span className="max-w-[200px] truncate text-xs text-muted-foreground/80">{page.text}</span>
                                )}
                                {isExpanded
                                  ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="space-y-4 px-5 pb-5 border-t-2 border-border/50 pt-4">
                                <div className="space-y-2">
                                  <label className="text-xs font-body font-bold text-muted-foreground">画面内容描述</label>
                                  <Textarea
                                    value={page.visualGoal}
                                    onChange={e => {
                                      dispatch({ type: 'UPDATE_STORYBOARD_PAGE', payload: { pageIndex: page.pageIndex, data: { visualGoal: e.target.value } } });
                                      triggerSave();
                                    }}
                                    className="ink-textarea min-h-[100px]"
                                    placeholder="请输入具体、可量化、纯视觉化的画面描述..."
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-body font-bold text-muted-foreground">画面文字</label>
                                  <Textarea
                                    value={page.text}
                                    onChange={e => {
                                      dispatch({ type: 'UPDATE_STORYBOARD_PAGE', payload: { pageIndex: page.pageIndex, data: { text: e.target.value } } });
                                      triggerSave();
                                    }}
                                    className="ink-textarea min-h-[80px]"
                                    placeholder="请输入本页呈现的文字内容..."
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {hasStoryResult && !story.generating && (
              <div className="mt-auto flex items-center gap-4 border-t-2 border-border/50 pt-6">
                <div className="text-sm font-body">
                  {canConfirm ? (
                    <span className="text-muted-foreground">确认后将进入素材设定阶段</span>
                  ) : (
                    <span className="text-amber-600 font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>请确保故事架构与分镜内容已完成</span>
                  )}
                  {hasDownstream && (
                    <span className="mt-1.5 block text-amber-600/80 text-xs">修改将使下游素材设定与逐页生成标记为待复查</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}