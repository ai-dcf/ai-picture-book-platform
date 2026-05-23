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
  const { storyboard, story, projectInfo } = state;
  const { generateStoryboard, error, clearError, getErrorMessage } = useStudioGenerate();
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
      storyboard.pages.some(
        p =>
          p.text.trim().length > 0 ||
          p.visualGoal.trim().length > 0
      ),
    [storyboard.pages]
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

  const canConfirm = storyboard.pages.length > 0 && storyboard.pages.some(p => p.text.trim().length > 0);



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

      </div>

      {error && !storyboard.generating && (
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

      {!storyboard.generating && hasStoryboardResult && (
        <ScrollArea className="flex-1 -mr-4 pr-4">
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
                          placeholder="请输入客观可呈现的视觉内容描述，仅包含场景、人物动作、物品等可见元素，避免抽象心理活动描述"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          提示：仅描述实际可见的画面元素，如“小兔子站在草地上抱着胡萝卜”，不要出现“小兔子很开心”这类心理描写
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
