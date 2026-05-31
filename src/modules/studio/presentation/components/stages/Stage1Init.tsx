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
  TargetAge,
  PageCount,
  ArtStyle,
} from '@/types/picturebook';
import { cn } from '@/lib/utils';

export default function Stage1Init() {
  const { state, dispatch, triggerSave } = useStudio();
  const { generateStoryPack } = useStudioGenerate();
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
      const pack = await generateStoryPack(projectInfo, form.title);
      if (pack?.story?.storyOutline) {
        handleChange('title', pack.story.storyOutline);
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
      const finalProjectInfo = {
        title: form.title.trim(),
        targetAge: 'auto' as TargetAge,
        pageCount: 'auto' as PageCount,
        artStyle: 'auto' as ArtStyle,
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
    <div className="flex flex-col h-full max-w-3xl mx-auto px-6 py-8 relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-primary/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-72 h-72 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-accent/10 via-accent/5 to-transparent pointer-events-none" />

      <div className="mb-10 text-center relative z-10">
        <div className="inline-flex items-center justify-center mb-6">
          <div className="seal-pattern w-12 h-12 rounded-sm flex items-center justify-center -rotate-6 mr-4 shadow-ink-medium">
            <span className="font-display text-white text-xl leading-none">壹</span>
          </div>
          <span className="text-sm font-body text-muted-foreground uppercase tracking-[0.3em]">
            起笔 · 构思
          </span>
        </div>
        <h2 className="font-display text-5xl text-foreground tracking-widest">描绘你的绘本世界</h2>
        <div className="divider-ink w-32 mx-auto my-6" />
        <p className="text-sm font-body text-muted-foreground/80">
          落笔无悔，意在笔先。写下你的故事大纲，我们将为你铺陈画卷。
        </p>
      </div>

      <div className="flex-1 space-y-8 relative z-10 card-ink rounded-[2rem] p-8 lg:p-12 shadow-ink-light">
        {createError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200/50 bg-red-50/50 px-5 py-4 text-sm text-red-700 backdrop-blur-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="flex-1 font-body">{createError}</span>
          </div>
        )}

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-base font-body font-bold text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            绘本主题与故事概要
            <span className="text-primary ml-0.5">*</span>
          </label>
          <div className="relative group">
            <Textarea
              ref={textareaRef}
              value={form.title}
              onChange={e => handleChange('title', e.target.value)}
              placeholder="请输入绘本主题、故事情节或者完整的故事概要，例如：小兔子学会分享的故事..."
              className="ink-textarea pr-28 w-full font-body text-base"
              rows={4}
            />
            <Button
              size="sm"
              className="absolute right-3 bottom-3 h-8 text-xs gap-1.5 btn-ink rounded-lg px-4 shadow-none"
              onClick={handleOptimize}
              disabled={isOptimizing || !form.title.trim()}
            >
              {isOptimizing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 润色中</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> 妙笔生花</>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-body font-bold text-foreground">
              <span className="w-1 h-1 rounded-full bg-accent" />
              目标受众
            </label>
            <Select
              value={form.targetAge}
              onValueChange={v => handleChange('targetAge', v as TargetAge)}
            >
              <SelectTrigger className="ink-input h-12 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="font-body">
                {TARGET_AGES.map(a => (
                  <SelectItem key={a} value={a}>{a === 'auto' ? '自动推演' : a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-body font-bold text-foreground">
              <span className="w-1 h-1 rounded-full bg-accent" />
              画卷风格
            </label>
            <Select
              value={form.artStyle}
              onValueChange={v => handleChange('artStyle', v as ArtStyle)}
            >
              <SelectTrigger className="ink-input h-12 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="font-body">
                {ART_STYLES.map(s => (
                  <SelectItem key={s} value={s}>{s === 'auto' ? '自动推演' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-body font-bold text-foreground">
            <span className="w-1 h-1 rounded-full bg-accent" />
            绘本页数
          </label>
          <div className="flex gap-3 flex-wrap">
            {PAGE_COUNTS.map(p => (
              <button
                key={p}
                onClick={() => handleChange('pageCount', p as PageCount)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-body border-2 transition-smooth",
                  form.pageCount === p
                    ? "border-primary bg-primary/5 text-primary font-medium shadow-ink-light"
                    : "border-border bg-background/50 text-foreground hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                {p === 'auto' ? '自动推演' : `${p} 页`}
              </button>
            ))}
          </div>
        </div>

        {showImpact && hasDownstream && (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/60 flex gap-3 mt-6 backdrop-blur-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm font-body text-amber-800">
              <p className="font-bold mb-1.5">修改参数将影响已生成的内容</p>
              <ul className="space-y-1 text-amber-700/80 list-disc list-inside ml-2">
                <li>修改「主题/受众/页数」将使故事架构和分镜拆页标记为已失效</li>
                <li>修改「风格」将使素材设定和逐页生成结果标记为待复查</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="pt-10 pb-6 mt-auto text-center relative z-10">
        <Button
          onClick={handleCreate}
          disabled={!canCreate || isAnalyzing || isOptimizing}
          size="lg"
          className="btn-ink h-14 px-10 rounded-2xl text-lg font-body font-medium shadow-ink-heavy seal-press gap-3"
        >
          {isAnalyzing ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> 推演中...</>
          ) : (
            <>落笔成卷 <ArrowRight className="w-5 h-5" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
