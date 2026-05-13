"use client";
import { useState } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BookOpen, Check, ChevronLeft, CloudUpload, Cpu, Loader2, Settings } from 'lucide-react';
import {
  TARGET_AGES,
  PAGE_COUNTS,
  ASPECT_RATIOS,
  ART_STYLES,
  PROJECT_STATUS_LABELS,
  TargetAge,
  PageCount,
  AspectRatio,
  ArtStyle,
} from '@/types/picturebook';

export default function TopBar() {
  const router = useRouter();
  const { state, dispatch, triggerSave } = useStudio();
  const { projectInfo } = state;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...projectInfo });

  function handleSave() {
    dispatch({
      type: 'SET_PROJECT_INFO',
      payload: {
        title: draft.title,
        targetAge: draft.targetAge as TargetAge,
        pageCount: draft.pageCount as PageCount,
        artStyle: draft.artStyle as ArtStyle,
        aspectRatio: draft.aspectRatio as AspectRatio,
      },
    });
    triggerSave();
    setOpen(false);
  }

  const saveIcon = projectInfo.saveStatus === 'saving'
    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
    : projectInfo.saveStatus === 'saved'
    ? <Check className="w-3.5 h-3.5" />
    : <CloudUpload className="w-3.5 h-3.5" />;

  const saveText = projectInfo.saveStatus === 'saving' ? '保存中…'
    : projectInfo.saveStatus === 'saved' ? '已保存'
    : '保存失败';

  const hasDownstream = state.currentStage > 1;

  return (
    <header className="h-14 flex items-center px-4 gap-4 bg-card border-b border-border shadow-card flex-shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-primary-foreground" />
        </div>
        <h1 className="font-display text-lg text-foreground truncate max-w-[200px]">
          {projectInfo.title || '未命名绘本'}
        </h1>
      </div>

      <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
        <Badge variant="secondary" className="text-xs font-body shrink-0">{projectInfo.targetAge}</Badge>
        <Badge variant="secondary" className="text-xs font-body shrink-0">{projectInfo.artStyle}</Badge>
        <Badge variant="secondary" className="text-xs font-body shrink-0">{projectInfo.pageCount} 页</Badge>
        <Badge variant="secondary" className="text-xs font-body shrink-0">{projectInfo.aspectRatio}</Badge>
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-body shrink-0',
            projectInfo.projectStatus === 'review' && 'border-amber-500 text-amber-600',
            projectInfo.projectStatus === 'exportable' && 'border-green-500 text-green-600',
          )}
        >
          {PROJECT_STATUS_LABELS[projectInfo.projectStatus]}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-body ml-auto">
        {saveIcon}
        <span className="hidden sm:inline">{saveText}</span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:text-foreground"
            onClick={() => setDraft({ ...projectInfo })}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">项目设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {hasDownstream && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">修改参数可能影响已生成的内容</p>
                  <p className="mt-1">修改「主题/年龄/页数」→ 故事架构、分镜拆页标记为已失效</p>
                  <p>修改「风格/比例」→ 素材设定、逐页生成结果标记为待复查</p>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-body font-medium">绘本主题</label>
              <Input
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="输入绘本主题…"
                className="font-body"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-body font-medium">目标年龄</label>
              <Select value={draft.targetAge} onValueChange={v => setDraft(d => ({ ...d, targetAge: v as TargetAge }))}>
                <SelectTrigger className="font-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_AGES.map(a => <SelectItem key={a} value={a} className="font-body">{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-body font-medium">绘本风格</label>
              <Select value={draft.artStyle} onValueChange={v => setDraft(d => ({ ...d, artStyle: v as ArtStyle }))}>
                <SelectTrigger className="font-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ART_STYLES.map(s => <SelectItem key={s} value={s} className="font-body">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-body font-medium">页数</label>
              <Select value={String(draft.pageCount)} onValueChange={v => setDraft(d => ({ ...d, pageCount: Number(v) as PageCount }))}>
                <SelectTrigger className="font-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_COUNTS.map(p => <SelectItem key={p} value={String(p)} className="font-body">{p} 页</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-body font-medium">画面比例</label>
              <Select value={draft.aspectRatio} onValueChange={v => setDraft(d => ({ ...d, aspectRatio: v as AspectRatio }))}>
                <SelectTrigger className="font-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map(r => <SelectItem key={r} value={r} className="font-body">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)} className="font-body">取消</Button>
              <Button onClick={handleSave} className="font-body gradient-hero text-primary-foreground border-0">保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Link href="/settings/models">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
          title="模型配置"
        >
          <Cpu className="w-4 h-4" />
        </Button>
      </Link>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/")}
        className="gap-1.5 text-muted-foreground font-body text-xs hidden sm:flex"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        返回首页
      </Button>
    </header>
  );
}
