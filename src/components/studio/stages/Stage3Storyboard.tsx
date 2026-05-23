"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useStudioGenerate } from '@/modules/studio/presentation/hooks/use-studio-generate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowRight,
  BookOpen,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Wand2,
} from 'lucide-react';

export default function Stage3Storyboard() {
  const { state, dispatch, triggerSave } = useStudio();
  const { storyboard, story, projectInfo, cover } = state;
  const { generateStoryboard, generateCover, error, clearError, getErrorMessage } = useStudioGenerate();
  const [expandedPage, setExpandedPage] = useState<number | null>(0);
  const autoTriggeredRef = useRef(false);

  const handleGenerate = useCallback(async () => {
    dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: true });
    dispatch({ type: 'SET_COVER_GENERATING', payload: true });
    clearError();
    const storyboardResult = await generateStoryboard(story, projectInfo);
    const coverResult = await generateCover(story, projectInfo);

    if (storyboardResult) {
      dispatch({ type: 'SET_STORYBOARD', payload: { ...storyboardResult, generating: false } });
    } else {
      dispatch({ type: 'SET_STORYBOARD_GENERATING', payload: false });
    }

    if (coverResult) {
      dispatch({
        type: 'SET_COVER',
        payload: {
          title: coverResult.title,
          visualGoal: coverResult.visualGoal,
          userModified: false,
          generating: false,
          status: coverResult.title.trim() || coverResult.visualGoal.trim() ? 'pending' : 'idle',
        },
      });
    } else {
      dispatch({ type: 'SET_COVER_GENERATING', payload: false });
    }

    if (storyboardResult || coverResult) {
      triggerSave();
    }
  }, [clearError, dispatch, generateCover, generateStoryboard, projectInfo, story, triggerSave]);

  const handleRegenerateCover = useCallback(async () => {
    dispatch({ type: 'SET_COVER_GENERATING', payload: true });
    clearError();
    const result = await generateCover(story, projectInfo);
    if (result) {
      dispatch({
        type: 'SET_COVER',
        payload: {
          title: result.title,
          visualGoal: result.visualGoal,
          userModified: false,
          generating: false,
          status: result.title.trim() || result.visualGoal.trim() ? 'pending' : 'idle',
        },
      });
      triggerSave();
    } else {
      dispatch({ type: 'SET_COVER_GENERATING', payload: false });
    }
  }, [clearError, dispatch, generateCover, projectInfo, story, triggerSave]);

  const hasStoryboardResult = useMemo(
    () =>
      storyboard.pages.some(
        p =>
          p.text.trim().length > 0 ||
          p.visualGoal.trim().length > 0
      ),
    [storyboard.pages]
  );
  const hasCoverResult = useMemo(
    () => cover.title.trim().length > 0 || cover.visualGoal.trim().length > 0,
    [cover.title, cover.visualGoal]
  );

  useEffect(() => {
    const canAutoGenerate =
      projectInfo.title.trim().length > 0 &&
      (story.storyOutline.trim().length > 0 ||
        story.characters.length > 0 ||
        story.scenes.length > 0);

    if (
      autoTriggeredRef.current ||
      storyboard.generating ||
      cover.generating ||
      hasStoryboardResult ||
      hasCoverResult ||
      !canAutoGenerate
    ) {
      return;
    }

    autoTriggeredRef.current = true;
    void handleGenerate();
  }, [
    handleGenerate,
    hasCoverResult,
    hasStoryboardResult,
    cover.generating,
    projectInfo.title,
    storyboard.generating,
    story.storyOutline,
    story.characters.length,
    story.scenes.length,
  ]);

  function handleConfirm() {
    dispatch({ type: 'INIT_ASSETS' });
    dispatch({ type: 'COMPLETE_STAGE', payload: 3 });
    triggerSave();
  }

  const canConfirm =
    storyboard.pages.length > 0 &&
    storyboard.pages.some(p => p.text.trim().length > 0) &&
    cover.title.trim().length > 0 &&
    cover.visualGoal.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">阶段 3 · 分镜拆页</span>
        </div>
        <h2 className="font-display text-2xl text-foreground">分镜拆页</h2>
        <p className="text-sm font-body text-muted-foreground mt-1">将故事架构转化为逐页分镜，包含客观画面内容描述和匹配年龄段的页面文字</p>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          onClick={handleGenerate}
          disabled={storyboard.generating || cover.generating}
          className="gap-2 font-body gradient-hero text-primary-foreground border-0"
        >
          {storyboard.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {storyboard.generating ? '生成中…' : hasStoryboardResult ? '再次手动触发分镜生成' : '整本生成分镜'}
        </Button>
        {hasStoryboardResult && (
          <Button onClick={handleGenerate} disabled={storyboard.generating || cover.generating} variant="outline" className="gap-2 font-body">
            <RefreshCw className="w-3.5 h-3.5" />
            重新生成
          </Button>
        )}

      </div>

      {error && !storyboard.generating && !cover.generating && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{getErrorMessage(error)}</span>
          <Button onClick={handleGenerate} size="sm" variant="outline" className="gap-1.5 font-body text-xs h-7 border-red-200 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50">
            <RefreshCw className="w-3 h-3" />
            重试
          </Button>
        </div>
      )}

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

      {!storyboard.generating && (hasStoryboardResult || hasCoverResult) && (
        <ScrollArea className="flex-1 -mr-4 pr-4">
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
                  onClick={() => void handleRegenerateCover()}
                  disabled={cover.generating || storyboard.generating}
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
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
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
        </ScrollArea>
      )}

      {!storyboard.generating && !hasStoryboardResult && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">首次进入本阶段会自动生成正文分镜和封面内容；如需重试，也可以手动触发生成</p>
          </div>
        </div>
      )}

      {(hasStoryboardResult || hasCoverResult) && !storyboard.generating && (
        <div className="pt-4 mt-auto border-t border-border flex items-center justify-between gap-4">
          <p className="text-xs font-body text-muted-foreground">确认分镜后将进入素材设定阶段，封面与内页将共同进入后续生成流程</p>
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
