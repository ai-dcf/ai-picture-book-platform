"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useStudioGenerate } from '@/modules/studio/presentation/hooks/use-studio-generate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, ArrowRight, BookOpen, ChevronDown, ChevronUp, Loader2, MapPin, RefreshCw, Users, Wand2 } from 'lucide-react';
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
    <div className={cn('border rounded-lg overflow-hidden bg-card', colorClass)}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <span className="text-sm font-body font-medium text-foreground truncate">{entry.name}</span>
          {entry.userModified && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-body">已修改</span>
          )}
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <Textarea
            value={entry.description}
            onChange={e => onDescChange(e.target.value)}
            placeholder="输入描述（外貌特征、性格等）…"
            className="font-body text-xs resize-none min-h-[64px]"
          />
          <p className="text-xs text-muted-foreground font-body mt-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            修改描述可能影响后续素材设定与逐页生成
          </p>
        </div>
      )}
      {!expanded && entry.description && (
        <p className="px-3 pb-2 text-xs font-body text-muted-foreground truncate">{entry.description}</p>
      )}
    </div>
  );
}

export default function Stage2Story() {
  const { state, dispatch, triggerSave } = useStudio();
  const { story, storyboard, cover, projectInfo, stageStatuses } = state;
  const { generateStoryPack, checkStoryPack, repairStoryPack, error, clearError, getErrorMessage } = useStudioGenerate();
  const [expandedPage, setExpandedPage] = useState<number | null>(0);
  const autoStoryPackTriggeredRef = useRef(false);
  const [checkReport, setCheckReport] = useState<StoryPackCheckReport | null>(null);
  const [lastGeneratedJson, setLastGeneratedJson] = useState<string>('');
  const [lastRationale, setLastRationale] = useState<string>('');

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

      const generatedJson = JSON.stringify({
        meta: {
          targetAge: result.meta.targetAge,
          pageCount: result.meta.pageCount,
          artStyle: result.meta.artStyle,
          rationale: result.meta.rationale || '',
        },
        story: result.story,
        storyboard: result.storyboard,
        cover: result.cover,
      });
      setLastGeneratedJson(generatedJson);
      setLastRationale(result.meta.rationale || '');
      triggerSave();
    } catch (err) {
      console.error('生成绘本内容失败', err);
      dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: false });
      dispatch({ type: 'SET_COVER_GENERATING', payload: false });
      dispatch({ type: 'SET_STORY_GENERATING', payload: false });
    }
  }, [clearError, dispatch, generateStoryPack, projectInfo, triggerSave]);

  const handleCheck = useCallback(async () => {
    clearError();
    const generatedJson = lastGeneratedJson || JSON.stringify({
      meta: {
        targetAge: projectInfo.targetAge,
        pageCount: projectInfo.pageCount,
        artStyle: projectInfo.artStyle,
        rationale: lastRationale || '',
      },
      story,
      storyboard,
      cover: { title: cover.title, visualGoal: cover.visualGoal },
    });
    setLastGeneratedJson(generatedJson);
    const report = await checkStoryPack(projectInfo.title, generatedJson);
    if (report) {
      setCheckReport(report);
    }
  }, [checkStoryPack, clearError, cover.title, cover.visualGoal, lastGeneratedJson, lastRationale, projectInfo, story, storyboard]);

  const handleRepair = useCallback(async () => {
    if (!checkReport) return;
    clearError();
    const originalJson = lastGeneratedJson || JSON.stringify({
      meta: {
        targetAge: projectInfo.targetAge,
        pageCount: projectInfo.pageCount,
        artStyle: projectInfo.artStyle,
        rationale: lastRationale || '',
      },
      story,
      storyboard,
      cover: { title: cover.title, visualGoal: cover.visualGoal },
    });
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

    const generatedJson = JSON.stringify({
      meta: {
        targetAge: result.meta.targetAge,
        pageCount: result.meta.pageCount,
        artStyle: result.meta.artStyle,
        rationale: result.meta.rationale || '',
      },
      story: result.story,
      storyboard: result.storyboard,
      cover: result.cover,
    });
    setLastGeneratedJson(generatedJson);
    setLastRationale(result.meta.rationale || '');
    triggerSave();
  }, [checkReport, clearError, cover.title, cover.visualGoal, dispatch, lastGeneratedJson, lastRationale, projectInfo, repairStoryPack, story, storyboard, triggerSave]);

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

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">阶段 2 · 故事架构与分镜拆页</span>
        </div>
        <h2 className="font-display text-2xl text-foreground">故事架构与分镜拆页</h2>
        <p className="text-sm font-body text-muted-foreground mt-1">先生成可编辑的故事结构，再将故事拆成逐页分镜与封面描述，进入后续素材设定与逐页生成流程</p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          onClick={handleGenerateAll}
          disabled={story.generating || storyboard.generating || cover.generating}
          className="gap-2 font-body gradient-hero text-primary-foreground border-0"
        >
          {story.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {story.generating ? '生成中…' : hasStoryResult || hasStoryboardResult || hasCoverResult ? '重新生成绘本内容' : '一键生成绘本内容'}
        </Button>
        {(hasStoryResult || hasStoryboardResult || hasCoverResult) && (
          <Button onClick={handleGenerateAll} disabled={story.generating || storyboard.generating || cover.generating} variant="outline" className="gap-2 font-body">
            <RefreshCw className="w-3.5 h-3.5" />
            重新生成
          </Button>
        )}
      </div>

      {error && !story.generating && !storyboard.generating && !cover.generating && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{getErrorMessage(error)}</span>
          <Button
            onClick={handleGenerateAll}
            size="sm"
            variant="outline"
            className="gap-1.5 font-body text-xs h-7 border-red-200 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50"
          >
            <RefreshCw className="w-3 h-3" />
            重试
          </Button>
        </div>
      )}

      {story.generating && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center mx-auto animate-pulse-soft">
              <Wand2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">正在构思故事架构，请稍候…</p>
          </div>
        </div>
      )}

      {!story.generating && hasStoryResult && (
        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-body font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs flex items-center justify-center font-display">1</span>
                故事大纲
              </h3>
              <Textarea
                value={story.storyOutline}
                onChange={e => { dispatch({ type: 'SET_STORY', payload: { storyOutline: e.target.value } }); triggerSave(); }}
                className="font-body text-sm resize-none min-h-[120px]"
                placeholder="输入故事大纲…"
              />
            </section>

            <section>
              <h3 className="text-sm font-body font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs flex items-center justify-center font-display">2</span>
                <Users className="w-3.5 h-3.5" />
                角色设定
                <span className="text-xs text-muted-foreground font-normal ml-1">（可编辑描述，不可新增/删除）</span>
              </h3>
              <div className="space-y-2">
                {story.characters.map(c => (
                  <EntryCard
                    key={c.name}
                    entry={c}
                    colorClass="border-primary/20"
                    onDescChange={desc => { dispatch({ type: 'UPDATE_CHARACTER_DESC', payload: { name: c.name, description: desc } }); triggerSave(); }}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-body font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs flex items-center justify-center font-display">3</span>
                <MapPin className="w-3.5 h-3.5" />
                场景清单
                <span className="text-xs text-muted-foreground font-normal ml-1">（可编辑描述，不可新增/删除）</span>
              </h3>
              <div className="space-y-2">
                {story.scenes.map(s => (
                  <EntryCard
                    key={s.name}
                    entry={s}
                    colorClass="border-accent/20"
                    onDescChange={desc => { dispatch({ type: 'UPDATE_SCENE_DESC', payload: { name: s.name, description: desc } }); triggerSave(); }}
                  />
                ))}
              </div>
            </section>

            <div className="pt-2 border-t border-border" />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-body font-semibold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs flex items-center justify-center font-display">4</span>
                  分镜拆页
                </h3>
                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerateAll}
                    disabled={story.generating || storyboard.generating || cover.generating}
                    className="gap-2 font-body gradient-hero text-primary-foreground border-0"
                  >
                    {storyboard.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {storyboard.generating ? '生成中…' : '重新生成绘本内容'}
                  </Button>
                  {(hasStoryResult || hasStoryboardResult || hasCoverResult) && (
                    <Button
                      onClick={handleGenerateAll}
                      disabled={story.generating || storyboard.generating || cover.generating}
                      variant="outline"
                      className="gap-2 font-body"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      重新生成
                    </Button>
                  )}
                  <Button
                    onClick={handleCheck}
                    disabled={story.generating || storyboard.generating || cover.generating || !(hasStoryResult || hasStoryboardResult || hasCoverResult)}
                    variant="outline"
                    className="font-body"
                  >
                    检查
                  </Button>
                  <Button
                    onClick={handleRepair}
                    disabled={story.generating || storyboard.generating || cover.generating || !checkReport}
                    variant="outline"
                    className="font-body"
                  >
                    修复
                  </Button>
                </div>
              </div>

              {storyboard.generating && (
                <div className="flex items-center justify-center py-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center mx-auto animate-pulse-soft">
                      <Wand2 className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <p className="text-sm font-body text-muted-foreground">正在生成逐页分镜，请稍候…</p>
                  </div>
                </div>
              )}

              {!storyboard.generating && !hasStoryboardResult && !hasCoverResult && (
                <div className="rounded-lg border border-border bg-card p-4 text-sm font-body text-muted-foreground">
                  首次进入本阶段会自动生成正文分镜和封面内容；如需重试，也可以手动触发生成
                </div>
              )}

              {!storyboard.generating && (hasStoryboardResult || hasCoverResult) && (
                <div className="space-y-3">
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">封面设置</span>
                        {cover.userModified && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-body">已修改</span>
                        )}
                      </div>
                      <Button
                        onClick={handleGenerateAll}
                        disabled={story.generating || cover.generating || storyboard.generating}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 font-body text-xs"
                      >
                        {cover.generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        {cover.generating ? '生成中…' : '重新生成封面内容'}
                      </Button>
                    </div>
                    <div className="px-3 py-3 space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-body font-medium text-muted-foreground">封面标题</label>
                        <Textarea
                          value={cover.title}
                          onChange={e => {
                            dispatch({ type: 'UPDATE_COVER_STORYBOARD_FIELDS', payload: { title: e.target.value } });
                            triggerSave();
                          }}
                          className="font-body text-sm resize-none min-h-[64px]"
                          placeholder="请输入封面标题，可基于项目标题继续微调为更适合绘本封面的展示标题"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-body font-medium text-muted-foreground">封面画面描述</label>
                        <Textarea
                          value={cover.visualGoal}
                          onChange={e => {
                            dispatch({ type: 'UPDATE_COVER_STORYBOARD_FIELDS', payload: { visualGoal: e.target.value } });
                            triggerSave();
                          }}
                          className="font-body text-sm resize-none min-h-[120px]"
                          placeholder="请输入封面插画的主体、动作、场景、构图、光影、色彩和标题留白区域；封面只生成纯插画，不要要求直接把标题画进图里"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          提示：封面描述同样只写“看得见的东西”，可补充主角、关键道具、场景关系、光影方向、主色调和标题留白位置。
                        </p>
                      </div>
                    </div>
                  </div>

                  {checkReport && (
                    <div className="rounded-lg border border-border bg-card px-3 py-3 text-sm font-body">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">检查结果</span>
                        <span className="text-xs text-muted-foreground">完整性 {checkReport.completenessScore}/10</span>
                        <span className="text-xs text-muted-foreground">连续性 {checkReport.continuityScore}/10</span>
                        <span className="text-xs text-muted-foreground">密度 {checkReport.densityScore}/10</span>
                        <span className={cn("text-xs font-medium", checkReport.overallPass ? "text-green-600" : "text-amber-600")}>
                          {checkReport.overallPass ? "通过" : "待修复"}
                        </span>
                      </div>
                      {checkReport.summary && (
                        <p className="mt-2 text-xs text-muted-foreground">{checkReport.summary}</p>
                      )}
                      {(checkReport.completenessIssues.length > 0 ||
                        checkReport.continuityIssues.length > 0 ||
                        checkReport.densityIssues.length > 0) && (
                        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                          {checkReport.completenessIssues.length > 0 && (
                            <div>完整性问题：{checkReport.completenessIssues.join("；")}</div>
                          )}
                          {checkReport.continuityIssues.length > 0 && (
                            <div>
                              连续性问题：
                              {checkReport.continuityIssues
                                .map((i) => `${i.pagePair} ${i.issue}`)
                                .join("；")}
                            </div>
                          )}
                          {checkReport.densityIssues.length > 0 && (
                            <div>
                              密度问题：
                              {checkReport.densityIssues
                                .map((i) => `第${i.page}页 ${i.issue} 建议：${i.suggestion}`)
                                .join("；")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

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
                            {page.userModified && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-body">已修改</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {page.text && (
                              <span className="text-xs text-muted-foreground max-w-[160px] truncate">{page.text}</span>
                            )}
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-3">
                            <div className="space-y-1.5">
                              <label className="text-xs font-body font-medium text-muted-foreground">画面内容描述</label>
                              <Textarea
                                value={page.visualGoal}
                                onChange={e => {
                                  dispatch({ type: 'UPDATE_STORYBOARD_PAGE', payload: { pageIndex: page.pageIndex, data: { visualGoal: e.target.value } } });
                                  triggerSave();
                                }}
                                className="font-body text-sm resize-none min-h-[100px]"
                                placeholder="请输入具体、可量化、纯视觉化的画面描述：默认直接写角色名称；只有当页造型、装束、道具状态或形体有变化时再补充变化点，同时写清眼睛和嘴巴形态、姿势动作、场景物体及位置/材质、光线方向与色温、具体颜色、景别/构图/视角；不要写开心、温暖、活泼等抽象词，也不要新增第 2 步之外的角色"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                提示：角色默认继承第 2 步设定，无变化时写名称即可；只描述“看得见的东西”，不要解释角色感受。可写“嘴巴咧开露齿，眼睛弯成月牙形”，不要直接写“很开心”；可写“左侧暖黄色侧光照在木桌上”，不要只写“温暖的氛围”
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-body font-medium text-muted-foreground">画面文字</label>
                              <Textarea
                                value={page.text}
                                onChange={e => {
                                  dispatch({ type: 'UPDATE_STORYBOARD_PAGE', payload: { pageIndex: page.pageIndex, data: { text: e.target.value } } });
                                  triggerSave();
                                }}
                                className="font-body text-sm resize-none min-h-[60px]"
                                placeholder="请输入本页呈现的文字内容，需匹配目标儿童年龄段的认知水平和文字复杂度要求"
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
        </ScrollArea>
      )}

      {!story.generating && !hasStoryResult && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">首次进入本阶段会自动生成故事架构；如需重试，也可以手动触发生成</p>
          </div>
        </div>
      )}

      {hasStoryResult && !story.generating && (
        <div className="pt-4 mt-auto border-t border-border flex items-center justify-between gap-4">
          <div className="text-xs font-body text-muted-foreground">
            {canConfirm ? (
              <span>确认后将进入素材设定阶段</span>
            ) : (
              <span className="text-amber-600">请确保故事架构与分镜内容已完成</span>
            )}
            {hasDownstream && (
              <span className="text-amber-600 block mt-1">修改将使下游素材设定与逐页生成标记为待复查</span>
            )}
          </div>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              'gap-2 font-body gradient-hero text-primary-foreground border-0',
              !canConfirm && 'opacity-50 cursor-not-allowed'
            )}
          >
            确认故事与分镜，进入素材设定
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
