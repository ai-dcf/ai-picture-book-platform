"use client";

import { Plus, BookOpen, Calendar, Trash2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProjectHistory } from "@/modules/project-history/use-project-history";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PROJECT_STATUS_LABELS, ART_STYLES, TARGET_AGES, type ProjectStatus } from "@/types/picturebook";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { User, Settings, LogOut } from "lucide-react";

function TopNav() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="flex items-center gap-2 mr-6">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-bold">AI 绘本工作室</span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={(session.user as any)?.avatarUrl} />
                    <AvatarFallback>
                      {((session.user as any)?.nickname || session.user.email || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {((session.user as any)?.nickname || session.user.email)}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>个人资料</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>设置</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="cursor-pointer flex items-center text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href="/login">登录</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function CreateNewProjectCard() {
  const router = useRouter();
  return (
    <Card
      className="group cursor-pointer card-ink hover:card-ink-hover transition-all duration-300"
      onClick={() => router.push("/studio")}
    >
      <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6">
        <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[hsl(16,72%,52%)] to-[hsl(35,85%,58%)] flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300 shadow-card">
          <Plus className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
        </div>
        <h3 className="text-lg sm:text-xl font-display mb-2 text-foreground">创建新项目</h3>
        <p className="text-sm text-muted-foreground text-center">开始创作你的下一本精彩绘本</p>
      </CardContent>
    </Card>
  );
}

function ProjectCard({ project, onOpen, onDelete }: {
  project: any;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="overflow-hidden card-ink group-hover:card-ink-hover transition-all duration-300">
      <div
        className="aspect-video bg-gradient-to-br from-[hsl(170,42%,45%)] via-[hsl(35,85%,58%)] to-[hsl(16,72%,52%)] flex items-center justify-center cursor-pointer relative overflow-hidden"
        onClick={onOpen}
      >
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <BookOpen className="w-12 h-12 text-white/50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0 mr-2">
            <CardTitle className="text-lg truncate">{project.title}</CardTitle>
            <CardDescription className="truncate">
              {PROJECT_STATUS_LABELS[project.projectStatus as ProjectStatus]} · {ART_STYLES.find((s) => s === project.artStyle) || project.artStyle}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>
            更新于 {formatDistanceToNow(new Date(project.updatedAt), {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
        </div>
        <Button
          className="w-full mt-4 btn-ink"
          onClick={onOpen}
        >
          继续创作
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function HeroPage() {
  const router = useRouter();
  const { projects, isLoading, deleteProject } = useProjectHistory();

  const handleOpenProject = (projectId: string) => {
    router.push(`/studio?projectId=${projectId}`);
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm("确定要删除这个项目吗？此操作无法撤销。")) {
      deleteProject(projectId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(38,40%,97%)] to-[hsl(38,30%,94%)]">
      <TopNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-10 sm:mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[hsl(16,72%,52%)] via-[hsl(35,85%,58%)] to-[hsl(170,42%,45%)]">
            AI 绘本工作室
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
            用人工智能的力量，将你的想象变成精美的绘本
          </p>
          <div className="divider-ink mx-auto max-w-xs sm:max-w-md" />
        </div>

        <div className="space-y-8 sm:space-y-12">
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              <CreateNewProjectCard />

              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden card-ink">
                    <div className="aspect-video bg-gradient-to-br from-[hsl(38,30%,94%)] to-[hsl(38,25%,88%)] animate-pulse" />
                    <CardHeader className="pb-2">
                      <div className="h-6 bg-muted rounded animate-pulse mb-2" />
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-4 bg-muted rounded animate-pulse w-1/2 mb-4" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))
              ) : projects.length > 0 ? (
                projects.map((project) => (
                  <ProjectCard
                    key={project.projectId}
                    project={project}
                    onOpen={() => handleOpenProject(project.projectId)}
                    onDelete={() => handleDeleteProject(project.projectId)}
                  />
                ))
              ) : null}
            </div>

            {!isLoading && projects.length === 0 && (
              <div className="col-span-full text-center py-8 sm:py-16">
                <div className="text-muted-foreground">
                  <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-20" />
                  <p className="text-base sm:text-lg font-display">还没有项目，开始你的第一个创作吧！</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
