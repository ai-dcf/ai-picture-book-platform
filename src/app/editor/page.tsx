"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useStudio } from "@/modules/studio/presentation/hooks/use-studio";
import { useStudioGenerate } from "@/modules/studio/presentation/hooks/use-studio-generate";
import { useToast } from "@/hooks/use-toast";
import EditorCanvas from "@/components/editor/EditorCanvas";
import EditorControlPanel from "@/components/editor/EditorControlPanel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, use } from "react";
import { exportAllPagesAsZip, exportPageAsPng } from "@/modules/studio/infrastructure/export-book";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
} from "lucide-react";
import { PAGE_STATUS_LABELS } from "@/types/picturebook";
import { cn } from "@/lib/utils";

export default function EditorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state, dispatch, triggerSave } = useStudio();
  const { generatePageImage } = useStudioGenerate();
  const { toast } = useToast();
  const { pages, editorStates, projectInfo } = state;

  const initPage = parseInt(searchParams.get("page") || "0", 10);
  const [currentPage, setCurrentPage] = useState(
    isNaN(initPage) || initPage < 0 || initPage >= pages.length ? 0 : initPage
  );
  const [regenerating, setRegenerating] = useState(false);
  const [exportingCurrent, setExportingCurrent] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  function goTo(idx: number) {
    if (idx < 0 || idx >= pages.length) return;
    setCurrentPage(idx);
    router.push(`/editor?page=${idx}`);
  }

  async function handleRegenerate() {
    const page = pages[currentPage];
    if (!page) return;

    setRegenerating(true);
    const storyboardPage = state.storyboard.pages[currentPage];
    const url = await generatePageImage(page, state.assets, projectInfo, storyboardPage);
    if (!url) {
      setRegenerating(false);
      return;
    }
    dispatch({ type: "SET_PAGE_IMAGE", payload: { index: currentPage, imageUrl: url } });
    triggerSave();
    setRegenerating(false);
  }

  function handleConfirmPage() {
    dispatch({ type: "CONFIRM_EDITOR_PAGE", payload: currentPage });
    triggerSave();
  }

  function handleReturnStudio() {
    router.push("/");
  }

  async function handleExportCurrentPage() {
    if (!page?.imageUrl) {
      toast({ title: "无法导出", description: "当前页缺少插画，请先完成页面生成。", variant: "destructive" });
      return;
    }
    try {
      setExportingCurrent(true);
      await exportPageAsPng({ page, editorState: editor, projectTitle: projectInfo.title });
      toast({ title: "导出成功", description: `第 ${currentPage + 1} 页已导出为 PNG。` });
    } catch (error) {
      toast({ title: "导出失败", description: error instanceof Error ? error.message : "导出失败，请稍后重试。", variant: "destructive" });
    } finally {
      setExportingCurrent(false);
    }
  }

  async function handleExportAllPages() {
    try {
      setExportingAll(true);
      const result = await exportAllPagesAsZip({ pages, editorStates, projectTitle: projectInfo.title });
      if (!result.successPages.length && result.skippedPages.length && !result.failedPages.length) {
        toast({ title: "无法导出", description: "当前没有可打包的页面，请先生成插画。", variant: "destructive" });
        return;
      }
      if (!result.successPages.length && result.failedPages.length) {
        toast({ title: "导出失败", description: `以下页面导出失败：第 ${result.failedPages.map(index => index + 1).join("、")} 页`, variant: "destructive" });
        return;
      }
      if (result.failedPages.length) {
        toast({ title: "部分导出完成", description: `已导出 ZIP，包含 ${result.successPages.length} 页；导出失败：第 ${result.failedPages.map(index => index + 1).join("、")} 页`, variant: "destructive" });
        return;
      }
      if (result.skippedPages.length) {
        toast({ title: "导出完成", description: `已导出 ZIP，包含 ${result.successPages.length} 页；未包含第 ${result.skippedPages.map(index => index + 1).join("、")} 页（尚未生成）。` });
        return;
      }
      toast({ title: "导出成功", description: `已导出 ZIP，包含 ${result.successPages.length} 页。` });
    } catch (error) {
      toast({ title: "导出失败", description: error instanceof Error ? error.message : "导出失败，请稍后重试。", variant: "destructive" });
    } finally {
      setExportingAll(false);
    }
  }

  const page = pages[currentPage];
  const editor = editorStates[currentPage];
  const exporting = exportingCurrent || exportingAll;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="h-12 flex items-center px-4 gap-3 bg-card border-b border-border shadow-card flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={handleReturnStudio} className="gap-1.5 font-body text-xs text-muted-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回创作台
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded gradient-hero flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-display text-base text-foreground truncate max-w-[120px] hidden sm:block">
            {projectInfo.title || "编辑页"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Button variant="outline" size="icon" className="w-7 h-7" disabled={currentPage === 0} onClick={() => goTo(currentPage - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1 overflow-hidden max-w-[240px]">
            {pages.map((_, i) => {
              const confirmed = editorStates[i]?.confirmed;
              return (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`flex-shrink-0 transition-smooth rounded-sm ${
                    i === currentPage
                      ? "w-6 h-2 bg-primary"
                      : confirmed
                      ? "w-2 h-2 rounded-full bg-green-500"
                      : "w-2 h-2 rounded-full bg-muted-foreground/30 hover:bg-primary/50"
                  }`}
                />
              );
            })}
          </div>
          <Button variant="outline" size="icon" className="w-7 h-7" disabled={currentPage === pages.length - 1} onClick={() => goTo(currentPage + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-xs font-body text-muted-foreground ml-1">
            {currentPage + 1} / {pages.length}
          </span>
        </div>
        <span className={cn("text-xs font-body ml-2", page?.pageStatus === "finalized" ? "text-green-600" : "text-muted-foreground")}>
          {page ? PAGE_STATUS_LABELS[page.pageStatus] : ""}
        </span>
      </header>
      <div className="flex flex-1 min-h-0 gap-0">
        <div className="flex-1 flex items-center justify-center p-6 bg-muted/30 overflow-auto">
          <div className="w-full max-w-lg">
            <EditorCanvas pageIndex={currentPage} />
            {page?.imageUrl && (
              <div className="flex justify-center gap-2 mt-3">
                <span className="text-xs font-body text-muted-foreground">拖动文本框可调整位置，拖动边角可缩放</span>
              </div>
            )}
          </div>
        </div>
        <div className="w-72 flex-shrink-0 border-l border-border bg-card flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display text-base text-foreground">第 {currentPage + 1} 页编辑</h3>
            {editor?.confirmed && (
              <span className="text-xs font-body text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 已确认定稿
              </span>
            )}
            {page?.pageStatus === "review" && (
              <span className="text-xs font-body text-amber-600">此页待复查，引用素材可能已变更</span>
            )}
          </div>
          <EditorControlPanel pageIndex={currentPage} />
        </div>
      </div>
      <div className="h-14 flex items-center justify-between px-4 bg-card border-t border-border flex-shrink-0">
        <Button variant="outline" size="sm" onClick={() => goTo(currentPage - 1)} disabled={currentPage === 0} className="gap-1.5 font-body text-xs">
          <ChevronLeft className="w-3.5 h-3.5" /> 上一页
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || !page?.imageUrl} className="gap-1.5 font-body text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> 重新生成插画
          </Button>
          <Button variant="outline" size="sm" onClick={() => { triggerSave(); }} className="gap-1.5 font-body text-xs">
            保存修改
          </Button>
          <Button size="sm" onClick={handleConfirmPage} disabled={editor?.confirmed || !page?.imageUrl} className="gap-1.5 font-body text-xs gradient-hero text-primary-foreground border-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> 确认本页定稿
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReturnStudio} className="gap-1.5 font-body text-xs">
            返回主流程
          </Button>
          {projectInfo.projectStatus === "exportable" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 font-body text-xs" disabled={exporting}>
                  <Download className="w-3.5 h-3.5" />
                  {exportingAll ? "批量导出中..." : exportingCurrent ? "导出中..." : "导出"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCurrentPage} disabled={exporting || !page?.imageUrl}>
                  导出当前页 PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportAllPages} disabled={exporting}>
                  导出全部页面 ZIP
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

