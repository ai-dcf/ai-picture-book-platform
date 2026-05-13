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

function CreateNewProjectCard() {
  const router = useRouter();
  return (
    <Card
      className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
      onClick={() => router.push("/studio")}
    >
      <CardContent className="flex flex-col items-center justify-center py-12 px-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Plus className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">创建新项目</h3>
        <p className="text-muted-foreground text-center">开始创作你的下一本精彩绘本</p>
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
    <Card className="overflow-hidden group">
      <div
        className="aspect-video bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center cursor-pointer"
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
          className="w-full mt-4"
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI 绘本工作室
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            用人工智能的力量，将你的想象变成精美的绘本
          </p>
        </div>

        {/* Content Section */}
        <div className="space-y-8">
          {/* Create New Project */}
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <CreateNewProjectCard />

              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="aspect-video bg-muted animate-pulse" />
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
              <div className="col-span-full text-center py-16">
                <div className="text-muted-foreground">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">还没有项目，开始你的第一个创作吧！</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
