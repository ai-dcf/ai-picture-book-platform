"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowRight,
  BookOpen,
  Clock3,
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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#120f1d]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(16,72%,52%)] via-[hsl(35,85%,58%)] to-[hsl(170,42%,45%)] shadow-[0_10px_30px_rgba(242,138,56,0.35)]">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-white">AI 绘本工作室</div>
            <div className="text-xs text-white/50">Immersive Creative Desk</div>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 rounded-full border border-white/10 bg-white/5 px-2 text-white hover:bg-white/10 hover:text-white">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={(session.user as { avatarUrl?: string }).avatarUrl} />
                    <AvatarFallback>
                      {((session.user as { nickname?: string }).nickname || session.user.email || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {((session.user as { nickname?: string }).nickname || session.user.email)}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex cursor-pointer items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>个人资料</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex cursor-pointer items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>设置</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex cursor-pointer items-center text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="btn-ink">
              <Link href="/login">登录</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function ProjectRailItem({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectHistoryEntry;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-3xl border border-white/10 bg-white/[0.04] p-3 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07]">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
            {project.thumbnailUrl ? (
              <img
                src={project.thumbnailUrl}
                alt={project.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-6 w-6 text-white/45" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-white">{project.title}</p>
              <Badge variant="outline" className="hidden border-white/10 bg-white/[0.06] text-[10px] text-white/65 sm:inline-flex">
                {PROJECT_STATUS_LABELS[project.projectStatus as ProjectStatus]}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-white/45">
              <Clock3 className="h-3.5 w-3.5" />
              <span>
                {formatDistanceToNow(new Date(project.updatedAt), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </span>
            </div>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-full text-white/55 hover:bg-white/10 hover:text-white"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={onDelete}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>删除项目</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
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
    <aside className="flex h-full flex-col rounded-[32px] border border-white/10 bg-[#161225]/90 p-4 shadow-[0_24px_80px_rgba(5,5,10,0.38)] backdrop-blur-xl">
      <div className="space-y-4 border-b border-white/10 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-white/35">Project Rail</p>
            <h2 className="mt-2 font-display text-2xl text-white">项目列表</h2>
          </div>
          <Button
            type="button"
            onClick={onResetWorkbench}
            className="rounded-2xl bg-white/10 px-4 text-white hover:bg-white/15"
          >
            <Plus className="mr-2 h-4 w-4" />
            新建
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索项目标题"
            className="h-12 rounded-2xl border-white/10 bg-white/[0.04] pl-11 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 rounded-3xl border border-white/10 bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : groupedProjects.length > 0 ? (
          <div className="space-y-6">
            {groupedProjects.map((group) => (
              <section key={group.label} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-xs tracking-[0.24em] text-white/35">{group.label}</span>
                </div>
                <div className="space-y-3">
                  {group.items.map((project) => (
                    <ProjectRailItem
                      key={project.projectId}
                      project={project}
                      onOpen={() => onOpenProject(project.projectId)}
                      onDelete={() => onDeleteProject(project.projectId)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 text-center">
            <BookOpen className="mb-4 h-10 w-10 text-white/25" />
            <p className="font-display text-lg text-white">
              {search.trim() ? "没有找到匹配的项目" : "还没有项目"}
            </p>
            <p className="mt-2 text-sm text-white/45">
              {search.trim() ? "试试更短的关键词，或者直接开始一个新故事。" : "右侧工作台已经准备好，随时开始第一本绘本。"}
            </p>
          </div>
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
    <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,205,120,0.18),_transparent_34%),linear-gradient(135deg,rgba(33,27,53,0.96),rgba(16,12,28,0.94))] p-6 shadow-[0_30px_90px_rgba(6,6,12,0.42)] sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(80,199,185,0.16),transparent_24%),radial-gradient(circle_at_20%_90%,rgba(247,139,80,0.18),transparent_28%)]" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.38em] text-white/35">Creation Workbench</p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-white sm:text-5xl">
              今天想创作什么样的绘本？
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
              左侧管理你的项目，右侧立即开始一个新的故事。创建成功后，会直接进入故事架构与分镜拆页阶段。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.24em] text-white/35">Step 01</div>
              <div className="mt-2 text-sm text-white/80">输入灵感</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.24em] text-white/35">Step 02</div>
              <div className="mt-2 text-sm text-white/80">AI 优化概要</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 col-span-2 sm:col-span-1">
              <div className="text-xs uppercase tracking-[0.24em] text-white/35">Step 03</div>
              <div className="mt-2 text-sm text-white/80">进入故事架构</div>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur-xl sm:p-6 lg:p-7">
          {error ? (
            <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-white">
                <Wand2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">绘本主题与故事概要</div>
                <div className="text-xs text-white/45">这是整个工作台的起点，尽量写得具体一些。</div>
              </div>
            </div>

            <Textarea
              value={form.title}
              onChange={(event) => onFormChange("title", event.target.value)}
              placeholder="例如：一只怕黑的小狐狸，如何在森林停电的夜晚学会勇敢地帮助朋友。"
              className="min-h-[220px] rounded-[28px] border-white/10 bg-white/[0.04] px-5 py-5 text-base leading-8 text-white placeholder:text-white/28"
            />

            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onQuickPrompt(prompt)}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/72 transition hover:bg-white/[0.1]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.28em] text-white/35">目标年龄</label>
              <Select
                value={form.targetAge}
                onValueChange={(value) => onFormChange("targetAge", value as TargetAge)}
              >
                <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_AGES.map((age) => (
                    <SelectItem key={age} value={age}>
                      {age === "auto" ? "自动推演" : age}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.28em] text-white/35">绘本页数</label>
              <Select
                value={String(form.pageCount)}
                onValueChange={(value) =>
                  onFormChange("pageCount", value === "auto" ? "auto" : Number(value))
                }
              >
                <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_COUNTS.map((count) => (
                    <SelectItem key={String(count)} value={String(count)}>
                      {count === "auto" ? "自动推演" : `${count} 页`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.28em] text-white/35">画风倾向</label>
              <Select
                value={form.artStyle}
                onValueChange={(value) => onFormChange("artStyle", value)}
              >
                <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ART_STYLES.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style === "auto" ? "自动推演" : style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm text-white/72">首页完成建项后，Studio 会直接打开故事架构与分镜拆页。</p>
              <div className="flex flex-wrap gap-2 text-xs text-white/40">
                <span className="rounded-full border border-white/10 px-3 py-1">故事架构与分镜拆页</span>
                <span className="rounded-full border border-white/10 px-3 py-1">素材设定</span>
                <span className="rounded-full border border-white/10 px-3 py-1">逐页生成</span>
                <span className="rounded-full border border-white/10 px-3 py-1">编辑定稿与导出</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                onClick={onOptimize}
                disabled={isOptimizing || isCreating || !form.title.trim()}
                className="h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-5 text-white hover:bg-white/[0.1] hover:text-white"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    优化中
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
                className="btn-ink h-12 rounded-2xl px-6"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建项目中
                  </>
                ) : (
                  <>
                    开始创作
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
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
    <div className="min-h-screen bg-[#0c0915] text-foreground">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,197,116,0.14),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(88,190,178,0.12),transparent_24%),linear-gradient(180deg,#130f1f,#09070f)]" />
      <TopNav />

      <main className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]">
          <ProjectRail
            projects={projects}
            isLoading={isLoading}
            search={search}
            onSearchChange={setSearch}
            onOpenProject={handleOpenProject}
            onDeleteProject={handleDeleteProject}
            onResetWorkbench={resetWorkbench}
          />

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
      </main>
    </div>
  );
}
