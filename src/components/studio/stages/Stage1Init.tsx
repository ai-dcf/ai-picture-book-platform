"use client";
import { useState } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import {
  TARGET_AGES,
  PAGE_COUNTS,
  ASPECT_RATIOS,
  ART_STYLES,
  TargetAge,
  PageCount,
  AspectRatio,
  ArtStyle,
} from '@/types/picturebook';

export default function Stage1Init() {
  const { state, dispatch, triggerSave } = useStudio();
  const { projectInfo, stageStatuses } = state;
  const hasDownstream = Object.values(stageStatuses).some(
    (s, i) => i > 0 && s !== 'idle'
  );

  const [form, setForm] = useState({
    title: projectInfo.title,
    targetAge: projectInfo.targetAge || 'auto',
    pageCount: projectInfo.pageCount || 'auto',
    artStyle: projectInfo.artStyle || 'auto',
    aspectRatio: projectInfo.aspectRatio,
  });

  const [showImpact, setShowImpact] = useState(false);

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }));
    if (hasDownstream) setShowImpact(true);
  }

  function handleCreate() {
    dispatch({
      type: 'SET_PROJECT_INFO',
      payload: {
        title: form.title,
        targetAge: form.targetAge as TargetAge,
        pageCount: form.pageCount as PageCount,
        artStyle: form.artStyle as ArtStyle,
        aspectRatio: form.aspectRatio as AspectRatio,
      },
    });
    if (!projectInfo.projectId) {
      dispatch({ type: 'CREATE_DRAFT' });
    }
    dispatch({ type: 'COMPLETE_STAGE', payload: 1 });
    triggerSave();
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
        <div className="space-y-2">
          <label className="text-sm font-body font-medium text-foreground">
            绘本主题
            <span className="text-destructive ml-0.5">*</span>
          </label>
          <Input
            value={form.title}
            onChange={e => handleChange('title', e.target.value)}
            placeholder="例如：小兔子学会分享的故事"
            className="font-body h-11 text-base"
          />
          <p className="text-xs font-body text-muted-foreground">描述你的绘本想讲述什么故事或主题</p>
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

        <div className="space-y-2">
          <label className="text-sm font-body font-medium text-foreground">画面比例</label>
          <div className="flex gap-2 flex-wrap">
            {ASPECT_RATIOS.map(r => (
              <button
                key={r}
                onClick={() => handleChange('aspectRatio', r as AspectRatio)}
                className={`px-4 py-2 rounded-lg text-sm font-body border transition-smooth ${
                  form.aspectRatio === r
                    ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                    : 'bg-card border-border text-foreground hover:border-primary/50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
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
          disabled={!canCreate}
          size="lg"
          className="gap-2 font-body text-base gradient-hero text-primary-foreground border-0 shadow-elevated hover:shadow-glow transition-smooth"
        >
          创建项目并继续
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
