"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Cpu,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
  Wand2,
  Loader2,
} from "lucide-react";
import { useProjectHistory } from "@/modules/project-history/use-project-history";
import { useStudioGenerate } from "@/modules/studio/presentation/hooks/use-studio-generate";
import { createStudioProjectState } from "@/modules/studio/presentation/utils/create-studio-project-state";
import type { ProjectHistoryEntry } from "@/modules/project-history/types";
import {
  ART_STYLES,
  PAGE_COUNTS,
  PROJECT_STATUS_LABELS,
  TARGET_AGES,
  type ArtStyle,
  type PageCount,
  type ProjectInfo,
  type ProjectStatus,
  type TargetAge,
} from "@/types/picturebook";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type HomeFormState = {
  title: string;
  targetAge: TargetAge;
  pageCount: PageCount;
  artStyle: ArtStyle;
};

const DEFAULT_FORM_STATE: HomeFormState = {
  title: "",
  targetAge: "auto",
  pageCount: "auto",
  artStyle: "auto",
};

const QUICK_PROMPTS = [
  "关于勇气与第一次尝试",
  "一个会发光的小镇秘密",
  "适合睡前阅读的温柔冒险",
];

function buildGenerationProjectInfo(form: HomeFormState): ProjectInfo {
  return {
    projectId: "",
    title: form.title.trim(),
    targetAge: form.targetAge,
    pageCount: form.pageCount,
    artStyle: form.artStyle,
    aspectRatio: "3:4",
    saveStatus: "saved",
    projectStatus: "draft",
  };
}

function generateProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function groupProjects(projects: ProjectHistoryEntry[]) {
  const groups = [
    { label: "今天", items: [] as ProjectHistoryEntry[] },
    { label: "昨天", items: [] as ProjectHistoryEntry[] },
    { label: "更早之前", items: [] as ProjectHistoryEntry[] },
  ];

  projects.forEach((project) => {
    const updatedAt = new Date(project.updatedAt);
    if (isToday(updatedAt)) {
      groups[0].items.push(project);
      return;
    }

    if (isYesterday(updatedAt)) {
      groups[1].items.push(project);
      return;
    }

    groups[2].items.push(project);
  });

  return groups.filter((group) => group.items.length > 0);
}

function TopNav() {
  const { data: session } = useSession();

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-white/5 bg-[#120f1d]/60 backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.05)]"
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(16,72%,52%)] via-[hsl(35,85%,58%)] to-[hsl(170,42%,45%)] shadow-[0_10px_30px_rgba(242,138,56,0.2)] transition-all duration-500 group-hover:scale-105 group-hover:shadow-[0_15px_40px_rgba(242,138,56,0.35)]">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-white/90 transition-colors duration-300 group-hover:text-white">AI 绘本工作室</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Immersive Creative Desk</div>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <>
              <Link href="/settings/models">
                <Button variant="ghost" className="h-10 rounded-full border border-white/5 bg-white/5 px-4 text-sm font-medium text-white/80 transition-all duration-300 hover:bg-white/10 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                  <Cpu className="mr-2 h-4 w-4" />
                  <span>大模型配置</span>
                </Button>
              </Link>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 rounded-full border border-white/5 bg-white/5 px-2 text-white transition-all duration-300 hover:bg-white/10 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                  <Avatar className="h-8 w-8 ring-2 ring-transparent transition-all duration-300 hover:ring-white/20">
                    <AvatarImage src={(session.user as { avatarUrl?: string }).avatarUrl} />
                    <AvatarFallback className="bg-white/10 text-white/80">
                      {((session.user as { nickname?: string }).nickname || session.user.email || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 border-white/5 bg-[#1a1625]/95 p-2 text-white/80 backdrop-blur-xl">
                <DropdownMenuLabel className="font-medium text-white/90">
                  {((session.user as { nickname?: string }).nickname || session.user.email)}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white rounded-xl transition-colors cursor-pointer">
                  <Link href="/profile" className="flex items-center py-2.5">
                    <User className="mr-3 h-4 w-4" />
                    <span>个人资料</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white rounded-xl transition-colors cursor-pointer">
                  <Link href="/settings" className="flex items-center py-2.5">
                    <Settings className="mr-3 h-4 w-4" />
                    <span>设置</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex cursor-pointer items-center py-2.5 text-red-400 focus:bg-red-500/10 focus:text-red-300 rounded-xl transition-colors"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <Button asChild className="h-10 rounded-full bg-white/10 px-6 text-sm font-medium text-white transition-all duration-300 hover:bg-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              <Link href="/login">登录</Link>
            </Button>
          )}
        </div>
      </div>
    </motion.header>
  );
}

function ProjectRailItem({
  project,
  onOpen,
  onDelete,
  index,
}: {
  project: ProjectHistoryEntry;
  onOpen: () => void;
  onDelete: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      className="group relative rounded-3xl border border-white/5 bg-white/[0.02] p-3 transition-all duration-500 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_8px_30px_rgba(255,255,255,0.04)]"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-start gap-4 text-left"
        >
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 transition-transform duration-500 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            {project.thumbnailUrl ? (
              <img
                src={project.thumbnailUrl}
                alt={project.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-6 w-6 text-white/30 transition-colors duration-300 group-hover:text-white/60" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2 py-1">
            <p className="truncate text-sm font-medium text-white/90 transition-colors duration-300 group-hover:text-white" title={project.title}>{project.title}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-white/40 transition-colors duration-300 group-hover:text-white/60">
                <Clock3 className="h-3.5 w-3.5" />
                <span>
                  {formatDistanceToNow(new Date(project.updatedAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
              <Badge variant="outline" className="shrink-0 border-white/10 bg-white/[0.04] text-[10px] text-white/50 transition-colors duration-300 group-hover:border-white/20 group-hover:text-white/80">
                {PROJECT_STATUS_LABELS[project.projectStatus as ProjectStatus]}
              </Badge>
            </div>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 shrink-0 rounded-full text-white/30 opacity-0 transition-all duration-300 hover:bg-white/10 hover:text-white group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-white/10"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-white/10 bg-[#1a1625] text-white/80 backdrop-blur-xl">
            <DropdownMenuItem
              onClick={onDelete}
              className="cursor-pointer text-red-400 focus:bg-red-500/20 focus:text-red-300"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>删除项目</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

function ProjectRail({
  projects,
  isLoading,
  search,
  onSearchChange,
  onOpenProject,
  onDeleteProject,
  onResetWorkbench,
}: {
  projects: ProjectHistoryEntry[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onResetWorkbench: () => void;
}) {
  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;

    return projects.filter((project) =>
      project.title.toLowerCase().includes(keyword)
    );
  }, [projects, search]);

  const groupedProjects = useMemo(
    () => groupProjects(filteredProjects),
    [filteredProjects]
  );

  return (
    <aside className="flex h-full flex-col rounded-[36px] border border-white/5 bg-[#161225]/60 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_24px_80px_rgba(5,5,10,0.5)] backdrop-blur-2xl transition-all duration-500 hover:border-white/10">
      <div className="space-y-5 border-b border-white/5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">Project Rail</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white/90">项目列表</h2>
          </div>
          <Button
            type="button"
            onClick={onResetWorkbench}
            className="rounded-2xl bg-white/5 px-4 text-sm font-medium text-white/90 transition-all duration-300 hover:bg-white/10 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
          >
            <Plus className="mr-2 h-4 w-4" />
            新建
          </Button>
        </div>

        <div className="relative group">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors duration-300 group-focus-within:text-[hsl(35,85%,58%)]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索项目标题"
            className="h-12 rounded-2xl border-white/5 bg-white/[0.02] pl-11 text-white placeholder:text-white/20 transition-all duration-300 focus:border-[hsl(35,85%,58%)]/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-[hsl(35,85%,58%)]/10"
          />
        </div>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className="h-24 rounded-3xl border border-white/5 bg-white/[0.02] animate-pulse" 
              />
            ))}
          </div>
        ) : groupedProjects.length > 0 ? (
          <div className="space-y-8">
            {groupedProjects.map((group, groupIndex) => (
              <motion.section 
                key={group.label} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: groupIndex * 0.1 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 px-2">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">{group.label}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
                <div className="space-y-3">
                  {group.items.map((project, index) => (
                    <ProjectRailItem
                      key={project.projectId}
                      project={project}
                      index={index}
                      onOpen={() => onOpenProject(project.projectId)}
                      onDelete={() => onDeleteProject(project.projectId)}
                    />
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/5 bg-white/[0.01] px-6 text-center"
          >
            <BookOpen className="mb-4 h-10 w-10 text-white/20" />
            <p className="font-display text-lg text-white/80">
              {search.trim() ? "没有找到匹配的项目" : "还没有项目"}
            </p>
            <p className="mt-2 text-sm text-white/40">
              {search.trim() ? "试试更短的关键词，或者直接开始一个新故事。" : "右侧工作台已经准备好，随时开始第一本绘本。"}
            </p>
          </motion.div>
        )}
      </div>
    </aside>
  );
}

function CreationWorkbench({
  form,
  error,
  isOptimizing,
  isCreating,
  onFormChange,
  onOptimize,
  onCreate,
  onQuickPrompt,
}: {
  form: HomeFormState;
  error: string | null;
  isOptimizing: boolean;
  isCreating: boolean;
  onFormChange: <K extends keyof HomeFormState>(key: K, value: HomeFormState[K]) => void;
  onOptimize: () => Promise<void>;
  onCreate: () => Promise<void>;
  onQuickPrompt: (value: string) => void;
}) {
  const canCreate = form.title.trim().length > 0 && !isCreating && !isOptimizing;

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-white/5 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,205,120,0.12),_transparent_40%),radial-gradient(ellipse_at_bottom_left,_rgba(80,199,185,0.1),_transparent_40%),linear-gradient(135deg,rgba(25,20,40,0.96),rgba(12,9,20,0.98))] p-6 shadow-[0_40px_100px_rgba(0,0,0,0.6)] sm:p-8 lg:p-12 transition-all duration-700 hover:border-white/10 hover:shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
      <div className="pointer-events-none absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(80,199,185,0.08),transparent_24%),radial-gradient(circle_at_20%_90%,rgba(247,139,80,0.12),transparent_28%)]" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <h1 className="mt-4 font-display text-4xl leading-[1.15] text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40 sm:text-5xl lg:text-6xl">
              今天想创作什么样的绘本？
            </h1>

          </div>


        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="rounded-[36px] border border-white/5 bg-black/20 p-6 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] sm:p-8 lg:p-10"
        >
          {error ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
              {error}
            </motion.div>
          ) : null}

          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                <Wand2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium tracking-wide text-white/90">绘本主题与故事概要</div>
                <div className="text-xs text-white/40">这是整个工作台的起点，尽量写得具体一些。</div>
              </div>
            </div>

            <Textarea
              value={form.title}
              onChange={(event) => onFormChange("title", event.target.value)}
              placeholder="例如：一只怕黑的小狐狸，如何在森林停电的夜晚学会勇敢地帮助朋友。"
              className="min-h-[220px] resize-none rounded-[28px] border-white/5 bg-white/[0.02] px-6 py-6 text-base leading-relaxed text-white placeholder:text-white/20 transition-all duration-300 focus:border-[hsl(35,85%,58%)]/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-[hsl(35,85%,58%)]/10"
            />

            <div className="flex flex-wrap gap-2.5">
              {QUICK_PROMPTS.map((prompt, i) => (
                <motion.button
                  key={prompt}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  type="button"
                  onClick={() => onQuickPrompt(prompt)}
                  className="rounded-full border border-white/5 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <div className="space-y-2.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 pl-1">目标年龄</label>
              <Select
                value={form.targetAge}
                onValueChange={(value) => onFormChange("targetAge", value as TargetAge)}
              >
                <SelectTrigger className="h-14 rounded-2xl border-white/5 bg-white/[0.02] px-5 text-white/90 transition-all duration-300 focus:border-[hsl(35,85%,58%)]/50 focus:ring-4 focus:ring-[hsl(35,85%,58%)]/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1a1625] text-white/90 backdrop-blur-xl">
                  {TARGET_AGES.map((age) => (
                    <SelectItem key={age} value={age} className="focus:bg-white/10 focus:text-white">
                      {age === "auto" ? "自动推演" : age}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 pl-1">绘本页数</label>
              <Select
                value={String(form.pageCount)}
                onValueChange={(value) =>
                  onFormChange("pageCount", value === "auto" ? "auto" : Number(value))
                }
              >
                <SelectTrigger className="h-14 rounded-2xl border-white/5 bg-white/[0.02] px-5 text-white/90 transition-all duration-300 focus:border-[hsl(35,85%,58%)]/50 focus:ring-4 focus:ring-[hsl(35,85%,58%)]/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1a1625] text-white/90 backdrop-blur-xl">
                  {PAGE_COUNTS.map((count) => (
                    <SelectItem key={String(count)} value={String(count)} className="focus:bg-white/10 focus:text-white">
                      {count === "auto" ? "自动推演" : `${count} 页`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 pl-1">画风倾向</label>
              <Select
                value={form.artStyle}
                onValueChange={(value) => onFormChange("artStyle", value)}
              >
                <SelectTrigger className="h-14 rounded-2xl border-white/5 bg-white/[0.02] px-5 text-white/90 transition-all duration-300 focus:border-[hsl(35,85%,58%)]/50 focus:ring-4 focus:ring-[hsl(35,85%,58%)]/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1a1625] text-white/90 backdrop-blur-xl">
                  {ART_STYLES.map((style) => (
                    <SelectItem key={style} value={style} className="focus:bg-white/10 focus:text-white">
                      {style === "auto" ? "自动推演" : style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-6 border-t border-white/5 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-white/60">首页完成建项后，Studio 会直接打开故事架构与分镜拆页。</p>
              <div className="flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-wider text-white/30">
                <span className="rounded-full border border-white/5 bg-white/[0.02] px-3 py-1.5">1. 故事架构与分镜拆页</span>
                <span className="rounded-full border border-white/5 bg-white/[0.02] px-3 py-1.5">2. 素材设定</span>
                <span className="rounded-full border border-white/5 bg-white/[0.02] px-3 py-1.5">3. 逐页生成</span>
                <span className="rounded-full border border-white/5 bg-white/[0.02] px-3 py-1.5">4. 编辑定稿与导出</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                onClick={onOptimize}
                disabled={isOptimizing || isCreating || !form.title.trim()}
                className="h-14 rounded-2xl border border-white/10 bg-white/[0.03] px-6 text-sm font-medium text-white transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] disabled:opacity-50"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    优化中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    妙笔生花
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={onCreate}
                disabled={!canCreate}
                className="h-14 rounded-2xl bg-gradient-to-br from-[hsl(16,72%,52%)] via-[hsl(35,85%,58%)] to-[hsl(170,42%,45%)] px-8 text-sm font-bold text-white shadow-[0_10px_30px_rgba(242,138,56,0.25)] transition-all duration-300 hover:scale-105 hover:shadow-[0_15px_40px_rgba(242,138,56,0.35)] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    创建项目中
                  </>
                ) : (
                  <>
                    开始创作
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { projects, isLoading, deleteProject } = useProjectHistory();
  const { generateStoryPack } = useStudioGenerate();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<HomeFormState>(DEFAULT_FORM_STATE);
  const [error, setError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  function handleFormChange<K extends keyof HomeFormState>(key: K, value: HomeFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetWorkbench() {
    setForm(DEFAULT_FORM_STATE);
    setError(null);
  }

  async function handleOptimize() {
    if (!form.title.trim() || isOptimizing) return;

    setError(null);
    setIsOptimizing(true);

    try {
      const pack = await generateStoryPack(buildGenerationProjectInfo(form), form.title.trim());
      if (!pack?.story?.storyOutline) {
        setError("故事优化失败，请稍后重试。");
        return;
      }

      setForm((prev) => ({
        title: pack.story.storyOutline,
        targetAge: prev.targetAge === "auto" ? pack.meta.targetAge : prev.targetAge,
        pageCount: prev.pageCount === "auto" ? pack.meta.pageCount : prev.pageCount,
        artStyle: prev.artStyle === "auto" ? pack.meta.artStyle : prev.artStyle,
      }));
    } catch (optimizeError) {
      console.error("优化失败", optimizeError);
      setError("故事优化失败，请稍后重试。");
    } finally {
      setIsOptimizing(false);
    }
  }

  async function handleCreate() {
    const title = form.title.trim();
    if (!title || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const projectId = generateProjectId();
      const state = createStudioProjectState({
        projectId,
        title,
        targetAge: form.targetAge,
        pageCount: form.pageCount,
        artStyle: form.artStyle,
      });

      const response = await fetch(`/api/projects/${projectId}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "创建项目失败");
      }

      router.push(`/studio?projectId=${projectId}`);
    } catch (createError) {
      console.error("创建项目失败", createError);
      setError(createError instanceof Error ? createError.message : "创建项目失败，请稍后重试。");
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenProject(projectId: string) {
    router.push(`/studio?projectId=${projectId}`);
  }

  function handleDeleteProject(projectId: string) {
    if (confirm("确定要删除这个项目吗？此操作无法撤销。")) {
      deleteProject(projectId);
    }
  }

  return (
    <div className="h-screen bg-[#0c0915] text-foreground font-body flex flex-col overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,197,116,0.1),transparent_40%),radial-gradient(circle_at_20%_20%,rgba(88,190,178,0.08),transparent_30%),linear-gradient(180deg,#130f1f,#09070f)]" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none" />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 min-h-0">
        <div className="grid h-full gap-6 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="h-full min-h-0">
            <ProjectRail
              projects={projects}
              isLoading={isLoading}
              search={search}
              onSearchChange={setSearch}
              onOpenProject={handleOpenProject}
              onDeleteProject={handleDeleteProject}
              onResetWorkbench={resetWorkbench}
            />
          </div>
          <div className="h-full min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-10">
            <CreationWorkbench
              form={form}
              error={error}
              isOptimizing={isOptimizing}
              isCreating={isCreating}
              onFormChange={handleFormChange}
              onOptimize={handleOptimize}
              onCreate={handleCreate}
              onQuickPrompt={(value) => handleFormChange("title", value)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
