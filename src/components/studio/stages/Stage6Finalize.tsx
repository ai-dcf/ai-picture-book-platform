"use client";
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { exportAllPagesAsZip, exportPageAsPng } from '@/modules/studio/infrastructure/export-book';
import { AspectRatio, PAGE_STATUS_LABELS, PageStatus } from '@/types/picturebook';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Expand,
  ImageIcon,
  Pencil,
  RefreshCw,
} from 'lucide-react';

function getAspectClass(ratio: AspectRatio) {
  const map: Record<AspectRatio, string> = {
    '3:4': 'aspect-[3/4]',
    '9:16': 'aspect-[9/16]',
    '16:9': 'aspect-[16/9]',
    '1:1': 'aspect-square',
  };
  return map[ratio];
}

function getStatusBadgeClass(status: PageStatus) {
  return cn(
    'text-[10px] font-body bg-transparent border',
    status === 'finalized' && 'text-green-600 border-green-600',
    status === 'generated' && 'text-blue-600 border-blue-600',
    status === 'review' && 'text-amber-600 border-amber-600'
  );
}

export default function Stage6Finalize() {
  const router = useRouter();
  const { toast } = useToast();
  const { state, dispatch } = useStudio();
  const { pages, editorStates, projectInfo, cover } = state;
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingTarget, setExportingTarget] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{ open: boolean; imageUrl: string; alt: string }>({ open: false, imageUrl: '', alt: '' });

  const generatedCount = pages.filter(page => Boolean(page.imageUrl)).length;
  const exportableCount = generatedCount + (cover.imageUrl ? 1 : 0);
  const finalizedCount = pages.filter(page => page.pageStatus === 'finalized').length;
  const allGenerated = pages.length > 0 && pages.every(page => Boolean(page.imageUrl));
  const allFinalized = pages.length > 0 && pages.every(page => page.pageStatus === 'finalized');
  const nextEditablePage = useMemo(
    () => pages.findIndex(page => page.imageUrl && page.pageStatus !== 'finalized'),
    [pages]
  );
  const coverAspectRatio = cover.aspectRatio || projectInfo.aspectRatio || '16:9';

  const exportSummary = useMemo(() => {
    const items: string[] = [];
    if (cover.imageUrl) items.push('封面');
    items.push(...pages.filter(page => page.imageUrl).map(page => `第 ${page.index + 1} 页`));
    return items;
  }, [cover.imageUrl, pages]);

  function openEditor(pageIndex: number) {
    router.push(`/editor?page=${pageIndex}`);
  }

  async function handleExportAllPages() {
    if (exportableCount === 0) {
      toast({
        title: '无法导出',
        description: '当前没有可导出的封面或页面，请先生成插画。',
        variant: 'destructive',
      });
      return;
    }

    try {
      setExportingAll(true);
      const result = await exportAllPagesAsZip({
        cover,
        pages,
        editorStates,
        projectTitle: projectInfo.title,
      });

      const successCount = result.successPages.length + (result.coverIncluded ? 1 : 0);
      const skippedLabels = [
        ...(result.coverSkipped ? ['封面'] : []),
        ...result.skippedPages.map(index => `第 ${index + 1} 页`),
      ];
      const failedLabels = [
        ...(result.coverFailed ? ['封面'] : []),
        ...result.failedPages.map(index => `第 ${index + 1} 页`),
      ];

      if (!successCount && skippedLabels.length && !failedLabels.length) {
        toast({
          title: '无法导出',
          description: '当前没有可打包的封面或页面，请先生成插画。',
          variant: 'destructive',
        });
        return;
      }

      if (!successCount && failedLabels.length) {
        toast({
          title: '导出失败',
          description: `以下内容导出失败：${failedLabels.join('、')}`,
          variant: 'destructive',
        });
        return;
      }

      if (failedLabels.length) {
        toast({
          title: '部分导出完成',
          description: `已导出 ZIP，包含 ${successCount} 项；导出失败：${failedLabels.join('、')}`,
          variant: 'destructive',
        });
        return;
      }

      if (skippedLabels.length) {
        toast({
          title: '导出完成',
          description: `已导出 ZIP，包含 ${successCount} 项；未包含 ${skippedLabels.join('、')}（尚未生成）。`,
        });
        return;
      }

      toast({
        title: '导出成功',
        description: `已导出 ZIP，包含 ${successCount} 项。`,
      });
    } catch (error) {
      toast({
        title: '导出失败',
        description: error instanceof Error ? error.message : '导出失败，请稍后重试。',
        variant: 'destructive',
      });
    } finally {
      setExportingAll(false);
    }
  }

  async function handleExportSinglePage(pageIndex: number) {
    const page = pages[pageIndex];
    if (!page?.imageUrl) {
      toast({
        title: '无法导出',
        description: '当前页缺少插画，请先完成页面生成。',
        variant: 'destructive',
      });
      return;
    }

    try {
      setExportingTarget(`page:${pageIndex}`);
      await exportPageAsPng({
        page,
        editorState: editorStates[pageIndex],
        projectTitle: projectInfo.title,
      });
      toast({
        title: '导出成功',
        description: `第 ${pageIndex + 1} 页已导出为 PNG。`,
      });
    } catch (error) {
      toast({
        title: '导出失败',
        description: error instanceof Error ? error.message : '导出失败，请稍后重试。',
        variant: 'destructive',
      });
    } finally {
      setExportingTarget(null);
    }
  }

  async function handleExportCover() {
    if (!cover.imageUrl) {
      toast({
        title: '无法导出',
        description: '当前封面缺少插画，请先完成封面生成。',
        variant: 'destructive',
      });
      return;
    }

    try {
      setExportingTarget('cover');
      await exportPageAsPng({
        cover,
        projectTitle: projectInfo.title,
      });
      toast({
        title: '导出成功',
        description: '封面已导出为 PNG。',
      });
    } catch (error) {
      toast({
        title: '导出失败',
        description: error instanceof Error ? error.message : '导出失败，请稍后重试。',
        variant: 'destructive',
      });
    } finally {
      setExportingTarget(null);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 py-4 border-b border-border bg-card">
        <h2 className="font-display text-2xl text-foreground">编辑定稿与导出</h2>
        <p className="text-sm font-body text-muted-foreground mt-1">
          所有页面生成后可逐页编辑定稿；同时也支持随时导出已生成页面。
        </p>
      </div>

      <div className="px-6 py-4 border-b border-border bg-background/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-body text-muted-foreground">生成完成</p>
            <p className="mt-1 text-2xl font-display text-foreground">{generatedCount} / {pages.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-body text-muted-foreground">定稿完成</p>
            <p className="mt-1 text-2xl font-display text-foreground">{finalizedCount} / {pages.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-body text-muted-foreground">项目状态</p>
            <p className="mt-1 text-base font-body font-medium text-foreground">
              {projectInfo.projectStatus === 'exportable' ? '可导出' : '待逐页定稿'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!allGenerated && (
            <Button
              variant="outline"
              onClick={() => dispatch({ type: 'SET_STAGE', payload: 4 })}
              className="gap-2 font-body"
            >
              <RefreshCw className="w-4 h-4" />
              返回逐页生成
            </Button>
          )}

          {allGenerated && nextEditablePage >= 0 && !allFinalized && (
            <Button
              onClick={() => openEditor(nextEditablePage)}
              className="gap-2 font-body gradient-hero text-primary-foreground border-0"
            >
              <Pencil className="w-4 h-4" />
              继续逐页定稿
            </Button>
          )}

          {exportableCount > 0 && (
            <Button
              onClick={handleExportAllPages}
              className="gap-2 font-body gradient-hero text-primary-foreground border-0"
              disabled={exportingAll || exportingTarget !== null}
            >
              <Download className="w-4 h-4" />
              {exportingAll ? '批量导出中...' : '导出全部页面 ZIP'}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => dispatch({ type: 'SET_STAGE', payload: 4 })}
            className="gap-2 font-body"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            返回逐页生成
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="font-display text-lg text-foreground">封面</h3>
                <p className="text-xs font-body text-muted-foreground mt-0.5 line-clamp-2">
                  {cover.title || cover.visualGoal || projectInfo.title || '暂无封面说明'}
                </p>
              </div>
              <Badge variant="secondary" className={getStatusBadgeClass(cover.status)}>
                {PAGE_STATUS_LABELS[cover.status]}
              </Badge>
            </div>

            <div className="p-4 flex gap-4">
              <button
                type="button"
                onClick={() => cover.imageUrl && setPreviewState({ open: true, imageUrl: cover.imageUrl, alt: '封面插画' })}
                className={cn(
                  'w-36 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border relative group',
                  getAspectClass(coverAspectRatio),
                  cover.imageUrl ? 'cursor-pointer' : 'cursor-default'
                )}
              >
                {cover.imageUrl ? (
                  <>
                    <img src={cover.imageUrl} alt="封面插画" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Expand className="w-5 h-5 text-white drop-shadow-md" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                )}
              </button>

              <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-body text-muted-foreground">当前状态</p>
                  <p className="text-sm font-body text-foreground">
                    {cover.imageUrl ? '封面已生成，可预览或导出' : '尚未生成封面，请返回阶段 4 完成生成'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {cover.imageUrl ? (
                    <Button
                      variant="outline"
                      onClick={handleExportCover}
                      disabled={exportingAll || exportingTarget !== null}
                      className="gap-2 font-body"
                    >
                      <Download className="w-4 h-4" />
                      {exportingTarget === 'cover' ? '导出中...' : '导出封面 PNG'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => dispatch({ type: 'SET_STAGE', payload: 4 })}
                      className="gap-2 font-body"
                    >
                      <RefreshCw className="w-4 h-4" />
                      返回阶段 4 生成
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {pages.map(page => (
            <div key={page.index} className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h3 className="font-display text-lg text-foreground">第 {page.index + 1} 页</h3>
                  <p className="text-xs font-body text-muted-foreground mt-0.5 line-clamp-2">
                    {page.storyText || '暂无页面文字'}
                  </p>
                </div>
                <Badge variant="secondary" className={getStatusBadgeClass(page.pageStatus)}>
                  {PAGE_STATUS_LABELS[page.pageStatus]}
                </Badge>
              </div>

              <div className="p-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => page.imageUrl && setPreviewState({ open: true, imageUrl: page.imageUrl, alt: `第 ${page.index + 1} 页插画` })}
                  className={cn(
                    'w-36 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border relative group',
                    getAspectClass(page.aspectRatio || projectInfo.aspectRatio || '16:9'),
                    page.imageUrl ? 'cursor-pointer' : 'cursor-default'
                  )}
                >
                  {page.imageUrl ? (
                    <>
                      <img src={page.imageUrl} alt={`第 ${page.index + 1} 页插画`} className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Expand className="w-5 h-5 text-white drop-shadow-md" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                </button>

                <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-body text-muted-foreground">当前状态</p>
                    <p className="text-sm font-body text-foreground">
                      {page.pageStatus === 'finalized'
                        ? '已完成编辑定稿'
                        : page.imageUrl
                        ? '已生成，待进入编辑页确认定稿'
                          : '尚未生成插画，请返回阶段 4 完成生成'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {page.imageUrl ? (
                      <>
                        <Button
                          onClick={() => openEditor(page.index)}
                          variant={page.pageStatus === 'finalized' ? 'outline' : 'default'}
                          className={cn(
                            'gap-2 font-body',
                            page.pageStatus !== 'finalized' && 'gradient-hero text-primary-foreground border-0'
                          )}
                        >
                          <Pencil className="w-4 h-4" />
                          {page.pageStatus === 'finalized' ? '查看已定稿页面' : '进入本页编辑定稿'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleExportSinglePage(page.index)}
                          disabled={exportingAll || exportingTarget !== null}
                          className="gap-2 font-body"
                        >
                          <Download className="w-4 h-4" />
                          {exportingTarget === `page:${page.index}` ? '导出中...' : '导出本页 PNG'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => dispatch({ type: 'SET_STAGE', payload: 4 })}
                        className="gap-2 font-body"
                      >
                        <RefreshCw className="w-4 h-4" />
                        返回阶段 4 生成
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={previewState.open} onOpenChange={open => setPreviewState(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-[95vw] w-auto p-0 border-0 bg-transparent shadow-none">
          {previewState.imageUrl ? (
            <img
              src={previewState.imageUrl}
              alt={previewState.alt}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-md"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

