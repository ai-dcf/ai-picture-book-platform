"use client";
import { useState, useRef, useEffect } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useStudioGenerate } from '@/modules/studio/presentation/hooks/use-studio-generate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import {
  TARGET_AGES,
  PAGE_COUNTS,
  ART_STYLES,
  ProjectInfo,
  TargetAge,
  PageCount,
  ArtStyle,
} from '@/types/picturebook';

export default function Stage1Init() {
  const { state, dispatch, triggerSave } = useStudio();
  const { generateStory, recommendProjectConfig } = useStudioGenerate();
  const { projectInfo, stageStatuses } = state;
  const hasDownstream = Object.values(stageStatuses).some(
    (s, i) => i > 0 && s !== 'idle'
  );

  const [form, setForm] = useState({
    title: projectInfo.title,
    targetAge: projectInfo.targetAge || 'auto',
    pageCount: projectInfo.pageCount || 'auto',
    artStyle: projectInfo.artStyle || 'auto',
  });

  const [showImpact, setShowImpact] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [form.title]);

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (hasDownstream) {
      setShowImpact(true);
    }
  }

  // 一键优化故事概要
  async function handleOptimize() {
    if (!form.title.trim() || isOptimizing) return;
    
    setIsOptimizing(true);
    try {
      // 调用大模型优化故事概要
      const tempProjectInfo: ProjectInfo = {
        ...projectInfo,
        title: form.title,
        targetAge: form.targetAge,
        pageCount: form.pageCount,
        artStyle: form.artStyle,
      };
      
      const story = await generateStory(tempProjectInfo);
      if (story) {
        // 使用生成的故事大纲作为优化后的内容
        handleChange('title', story.storyOutline || form.title);
      }
    } catch (err) {
      console.error('优化失败', err);
    } finally {
      setIsOptimizing(false);
    }
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    
    setIsAnalyzing(true);
    setCreateError(null);
    try {
      const tempProjectInfo: ProjectInfo = {
        ...projectInfo,
        title: form.title,
        targetAge: form.targetAge,
        pageCount: form.pageCount,
        artStyle: form.artStyle,
      };
      
      const needsRecommendation =
        form.targetAge === 'auto' || form.pageCount === 'auto' || form.artStyle === 'auto';

      const recommendation = needsRecommendation
        ? await recommendProjectConfig(tempProjectInfo)
        : null;

      if (needsRecommendation && !recommendation) {
        setCreateError('项目参数推荐失败，请重试或先在设置中配置可用模型');
        return;
      }

      if (form.targetAge === 'auto' && !recommendation?.recommendedTargetAge) {
        setCreateError('未能推荐目标年龄，请重试');
        return;
      }
      if (form.pageCount === 'auto' && !recommendation?.recommendedPageCount) {
        setCreateError('未能推荐页数，请重试');
        return;
      }
      if (form.artStyle === 'auto' && !recommendation?.recommendedArtStyle) {
        setCreateError('未能推荐绘本风格，请重试');
        return;
      }

      const finalProjectInfo = {
        title: form.title.trim(),
        targetAge: form.targetAge === 'auto' && recommendation?.recommendedTargetAge
          ? recommendation.recommendedTargetAge
          : form.targetAge as TargetAge,
        pageCount: form.pageCount === 'auto' && recommendation?.recommendedPageCount
          ? recommendation.recommendedPageCount
          : form.pageCount as PageCount,
        artStyle: form.artStyle === 'auto' && recommendation?.recommendedArtStyle
          ? recommendation.recommendedArtStyle
          : form.artStyle as ArtStyle,
      };
      
      // 更新项目信息
      dispatch({
        type: 'SET_PROJECT_INFO',
        payload: finalProjectInfo,
      });
      
      if (!projectInfo.projectId) {
        dispatch({ type: 'CREATE_DRAFT' });
      }
      triggerSave();
      dispatch({ type: 'SET_STAGE', payload: 2 });
    } catch (err) {
      console.error('项目创建失败', err);
      setCreateError(err instanceof Error ? err.message : '项目参数推荐失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  }

  const canCreate = form.title.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded gradient-hero flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">
            阶段 1 · 项目初始化
          </span>
        </div>
        <h2 className="font-display text-3xl text-foreground mt-2">开始创建你的绘本</h2>
        <p className="text-sm font-body text-muted-foreground mt-1">
          先确认基础参数，系统会自动创建草稿并保存
        </p>
      </div>

      <div className="flex-1 space-y-6 max-w-lg">
        {createError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1 font-body">{createError}</span>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-body font-medium text-foreground">
            绘本主题/故事概要
            <span className="text-destructive ml-0.5">*</span>
          </label>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={form.title}
              onChange={e => handleChange('title', e.target.value)}
              placeholder="输入绘本主题、故事情节或者完整的故事概要，例如：小兔子学会分享的故事..."
              className="font-body pr-24 resize-none min-h-[80px] max-h-[240px] overflow-y-auto"
              rows={3}
            />
            <Button
              size="sm"
              variant="secondary"
              className="absolute right-2 bottom-2 h-7 text-xs gap-1"
              onClick={handleOptimize}
              disabled={isOptimizing || !form.title.trim()}
            >
              {isOptimizing ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> 优化中</>
              ) : (
                <><Sparkles className="w-3 h-3" /> 一键优化</>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-body font-medium text-foreground">目标年龄</label>
          <Select
            value={form.targetAge}
            onValueChange={v => handleChange('targetAge', v as TargetAge)}
          >
            <SelectTrigger className="font-body h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_AGES.map(a => (
                <SelectItem key={a} value={a} className="font-body">{a === 'auto' ? '自动' : a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-body font-medium text-foreground">页数</label>
          <div className="flex gap-2 flex-wrap">
            {PAGE_COUNTS.map(p => (
              <button
                key={p}
                onClick={() => handleChange('pageCount', p as PageCount)}
                className={`px-4 py-2 rounded-lg text-sm font-body border transition-smooth ${
                  form.pageCount === p
                    ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                    : 'bg-card border-border text-foreground hover:border-primary/50'
                }`}
              >
                {p === 'auto' ? '自动' : `${p} 页`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-body font-medium text-foreground">绘本风格</label>
          <Select
            value={form.artStyle}
            onValueChange={v => handleChange('artStyle', v as ArtStyle)}
          >
            <SelectTrigger className="font-body h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ART_STYLES.map(s => (
                <SelectItem key={s} value={s} className="font-body">{s === 'auto' ? '自动' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>



        {showImpact && hasDownstream && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs font-body text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">修改参数将影响已生成的内容</p>
              <p>修改「主题/年龄/页数」将使故事架构和分镜拆页标记为已失效</p>
              <p>修改「风格/比例」将使素材设定和逐页生成结果标记为待复查</p>
            </div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-muted/60 border border-border">
          <p className="text-xs font-body text-muted-foreground">
            提示：修改这些参数可能影响后续故事、分镜、素材与页面结果
          </p>
        </div>
      </div>

      <div className="pt-6 mt-auto border-t border-border">
        <Button
          onClick={handleCreate}
          disabled={!canCreate || isAnalyzing || isOptimizing}
          size="lg"
          className="gap-2 font-body text-base gradient-hero text-primary-foreground border-0 shadow-elevated hover:shadow-glow transition-smooth"
        >
          {isAnalyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 分析中...</>
          ) : (
            <>创建项目并继续 <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
