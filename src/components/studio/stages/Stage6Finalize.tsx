"use client";
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { exportAllPagesAsZip, exportPageAsPng } from '@/modules/studio/infrastructure/export-book';
import { PAGE_STATUS_LABELS } from '@/types/picturebook';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ImageIcon,
  Pencil,
  RefreshCw,
} from 'lucide-react';

export default function Stage6Finalize() {
  const router = useRouter();
  const { toast } = useToast();
  const { state, dispatch } = useStudio();
  const { pages, editorStates, projectInfo } = state;
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingPageIndex, setExportingPageIndex] = useState<number | null>(null);

  const generatedCount = pages.filter(page => Boolean(page.imageUrl)).length;
  const finalizedCount = pages.filter(page => page.pageStatus === 'finalized').length;
  const allGenerated = pages.length > 0 && pages.every(page => Boolean(page.imageUrl));
  const allFinalized = pages.length > 0 && pages.every(page => page.pageStatus === 'finalized');
  const nextEditablePage = useMemo(
    () => pages.findIndex(page => page.imageUrl && page.pageStatus !== 'finalized'),
    [pages]
  );

  function openEditor(pageIndex: number) {
    router.push(`/editor?page=${pageIndex}`);
  }

  async function handleExportAllPages() {
    if (generatedCount === 0) {
      toast({
        title: '无法导出',
        description: '当前没有可导出的页面，请先生成插画。',
        variant: 'destructive',
      });
      return;
    }

    try {
      setExportingAll(true);
      const result = await exportAllPagesAsZip({
        pages,
        editorStates,
        projectTitle: projectInfo.title,
      });

      if (!result.successPages.length && result.skippedPages.length && !result.failedPages.length) {
        toast({
          title: '无法导出',
          description: '当前没有可打包的页面，请先生成插画。',
          variant: 'destructive',
        });
        return;
      }

      if (!result.successPages.length && result.failedPages.length) {
        toast({
          title: '导出失败',
          description: `以下页面导出失败：第 ${result.failedPages.map(index => index + 1).join('、')} 页`,
          variant: 'destructive',
        });
        return;
      }

      if (result.failedPages.length) {
        toast({
          title: '部分导出完成',
          description: `已导出 ZIP，包含 ${result.successPages.length} 页；导出失败：第 ${result.failedPages.map(index => index + 1).join('、')} 页`,
          variant: 'destructive',
        });
        return;
      }

      if (result.skippedPages.length) {
        toast({
          title: '导出完成',
          description: `已导出 ZIP，包含 ${result.successPages.length} 页；未包含第 ${result.skippedPages.map(index => index + 1).join('、')} 页（尚未生成）。`,
        });
        return;
      }

      toast({
        title: '导出成功',
        description: `已导出 ZIP，包含 ${result.successPages.length} 页。`,
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
      setExportingPageIndex(pageIndex);
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
      setExportingPageIndex(null);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">阶段 6 · 编辑定稿与导出</span>
        </div>
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
              onClick={() => dispatch({ type: 'SET_STAGE', payload: 5 })}
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

          {generatedCount > 0 && (
            <Button
              onClick={handleExportAllPages}
              className="gap-2 font-body gradient-hero text-primary-foreground border-0"
              disabled={exportingAll || exportingPageIndex !== null}
            >
              <Download className="w-4 h-4" />
              {exportingAll ? '批量导出中...' : '导出全部页面 ZIP'}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => dispatch({ type: 'SET_STAGE', payload: 5 })}
            className="gap-2 font-body"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            返回逐页生成
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {pages.map(page => (
            <div key={page.index} className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h3 className="font-display text-lg text-foreground">第 {page.index + 1} 页</h3>
                  <p className="text-xs font-body text-muted-foreground mt-0.5 line-clamp-2">
                    {page.storyText || '暂无页面文字'}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px] font-body',
                    page.pageStatus === 'finalized' && 'text-green-600 border-green-600',
                    page.pageStatus === 'generated' && 'text-blue-600 border-blue-600',
                    page.pageStatus === 'review' && 'text-amber-600 border-amber-600',
                    'bg-transparent border'
                  )}
                >
                  {PAGE_STATUS_LABELS[page.pageStatus]}
                </Badge>
              </div>

              <div className="p-4 flex gap-4">
                <div className="w-28 h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
                  {page.imageUrl ? (
                    <img src={page.imageUrl} alt={`第 ${page.index + 1} 页插画`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-body text-muted-foreground">当前状态</p>
                    <p className="text-sm font-body text-foreground">
                      {page.pageStatus === 'finalized'
                        ? '已完成编辑定稿'
                        : page.imageUrl
                        ? '已生成，待进入编辑页确认定稿'
                        : '尚未生成插画，请返回阶段 5 完成生成'}
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
                          disabled={exportingAll || exportingPageIndex !== null}
                          className="gap-2 font-body"
                        >
                          <Download className="w-4 h-4" />
                          {exportingPageIndex === page.index ? '导出中...' : '导出本页 PNG'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => dispatch({ type: 'SET_STAGE', payload: 5 })}
                        className="gap-2 font-body"
                      >
                        <RefreshCw className="w-4 h-4" />
                        返回阶段 5 生成
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

