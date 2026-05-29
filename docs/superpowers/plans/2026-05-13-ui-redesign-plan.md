# AI 绘本工作室 UI 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 绘本工作室 UI 重构为独特的东方水墨风格，包括重构色彩系统、字体系统、视觉元素和组件样式

**Architecture:** 基于现有 Tailwind CSS + shadcn/ui 架构，重构 globals.css 和 tailwind.config.ts，添加水墨风格的自定义 CSS 类，更新核心页面组件

**Tech Stack:** 
- Next.js 15 (App Router)
- Tailwind CSS
- shadcn/ui components
- CSS Variables
- Google Fonts (Ma Shan Zheng, Noto Serif SC)

---

## 阶段一：基础样式重构

### Task 1: 重构 globals.css 颜色变量

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 备份现有 globals.css**

```bash
cp src/app/globals.css src/app/globals.css.backup
```

- [ ] **Step 2: 重写 globals.css 为水墨风格配色**

创建新的 `globals.css`：

```css
@import url('https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@300;400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* 主色系 - 水墨灰白 */
    --background: 40 10% 98%;      /* #FAFAF8 - 宣纸白 */
    --foreground: 0 0% 10%;         /* #1A1A1A - 墨色 */
    --card: 40 8% 97%;             /* #F7F7F5 - 淡宣纸 */
    --card-foreground: 0 0% 10%;   /* 墨色 */
    --popover: 0 0% 100%;          /* 纯白 */
    --popover-foreground: 0 0% 10%;

    /* 强调色 - 朱红印章 */
    --primary: 356 58% 54%;         /* #C53D43 - 朱红 */
    --primary-foreground: 0 0% 100%;

    /* 次要色 - 青墨 */
    --accent: 185 20% 60%;          /* #7BA3A8 - 青墨 */
    --accent-foreground: 0 0% 100%;

    /* 辅助色 */
    --muted: 40 8% 94%;            /* 淡墨灰 */
    --muted-foreground: 0 0% 45%;   /* 水墨灰 */
    --destructive: 0 62% 50%;       /* 错误红 */
    --destructive-foreground: 0 0% 100%;

    /* 边框和输入 */
    --border: 40 8% 88%;            /* 淡墨边框 */
    --input: 40 8% 88%;
    --ring: 356 58% 54%;            /* 朱红环 */

    /* 状态色 */
    --status-confirmed: 145 35% 40%;    /* 成功绿 */
    --status-generated: 210 50% 50%;     /* 生成蓝 */
    --status-review: 356 45% 55%;       /* 审查橙 */
    --status-pending: 40 10% 60%;        /* 待处理灰 */

    /* 圆角 */
    --radius: 0.5rem;

    /* 渐变 */
    --gradient-hero: linear-gradient(135deg, hsl(40 10% 98%) 0%, hsl(40 8% 94%) 100%);
    --gradient-ink: linear-gradient(135deg, hsl(0 0% 10%) 0%, hsl(0 0% 29%) 100%);

    /* 阴影 */
    --shadow-sm: 0 2px 8px rgba(26, 26, 26, 0.04);
    --shadow-md: 0 8px 24px rgba(26, 26, 26, 0.08);
    --shadow-lg: 0 16px 48px rgba(26, 26, 26, 0.12);
  }

  .dark {
    --background: 0 0% 8%;           /* 深墨色 */
    --foreground: 40 10% 95%;         /* 淡宣纸 */
    --card: 0 0% 12%;                /* 深卡 */
    --card-foreground: 40 10% 95%;
    --popover: 0 0% 12%;
    --popover-foreground: 40 10% 95%;
    --primary: 356 58% 58%;           /* 亮朱红 */
    --primary-foreground: 0 0% 100%;
    --accent: 185 20% 65%;           /* 亮青墨 */
    --accent-foreground: 0 0% 100%;
    --muted: 0 0% 15%;
    --muted-foreground: 0 0% 60%;
    --destructive: 0 62% 55%;
    --destructive-foreground: 0 0% 100%;
    --border: 0 0% 20%;
    --input: 0 0% 20%;
    --ring: 356 58% 58%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'Noto Serif SC', serif;
    line-height: 1.8;
  }

  h1, h2, h3, h4, h5, h6, .font-display {
    font-family: 'Ma Shan Zheng', cursive;
    font-weight: 400;
    line-height: 1.3;
  }
}

@layer utilities {
  /* 渐变工具类 */
  .gradient-hero { background: var(--gradient-hero); }
  .gradient-ink { background: var(--gradient-ink); }

  /* 状态文字颜色 */
  .text-status-confirmed { color: hsl(var(--status-confirmed)); }
  .text-status-generated { color: hsl(var(--status-generated)); }
  .text-status-review { color: hsl(var(--status-review)); }
  .text-status-pending { color: hsl(var(--status-pending)); }

  /* 状态背景颜色 */
  .bg-status-confirmed { background-color: hsl(var(--status-confirmed) / 0.12); }
  .bg-status-generated { background-color: hsl(var(--status-generated) / 0.12); }
  .bg-status-review { background-color: hsl(var(--status-review) / 0.12); }
  .bg-status-pending { background-color: hsl(var(--status-pending) / 0.12); }

  /* 水墨笔触效果 */
  .border-ink {
    @apply border-border;
    position: relative;
  }

  .border-ink::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(26, 26, 26, 0.05) 0%, transparent 50%, rgba(26, 26, 26, 0.03) 100%);
    pointer-events: none;
  }

  /* 水墨晕染阴影 */
  .shadow-ink {
    box-shadow: var(--shadow-sm);
    transition: all 0.3s ease;
  }

  .shadow-ink:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  /* 宣纸背景 */
  .bg-paper {
    background-color: hsl(var(--background));
    background-image:
      radial-gradient(ellipse at 20% 30%, rgba(26, 26, 26, 0.02) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 70%, rgba(26, 26, 26, 0.01) 0%, transparent 40%);
  }

  /* 毛笔分隔线 */
  .divider-ink {
    position: relative;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, hsl(0 0% 29%) 20%, hsl(0 0% 10%) 50%, hsl(0 0% 29%) 80%, transparent 100%);
  }

  .divider-ink::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 30%;
    width: 40%;
    height: 5px;
    background: radial-gradient(ellipse at center, rgba(26, 26, 26, 0.1) 0%, transparent 70%);
  }
}
```

- [ ] **Step 3: 验证 CSS 变量加载**

Run: `npm run dev` 启动开发服务器，检查浏览器控制台无错误

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "refactor: apply ink painting color scheme to globals.css"
```

---

### Task 2: 更新 tailwind.config.ts 字体配置

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: 更新 tailwind.config.ts 配置**

修改 `tailwind.config.ts`：

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/*/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Ma Shan Zheng'", "cursive"],
        body: ["'Noto Serif SC'", "serif"],
        sans: ["'Noto Sans SC'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "ink-spread": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "50%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "ink-spread": "ink-spread 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 2: 运行 build 检查配置**

Run: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "refactor: update Tailwind config with ink painting typography"
```

---

## 阶段二：核心组件重构

### Task 3: 重构首页 HeroPage

**Files:**
- Modify: `src/app/components/HeroPage.tsx`

- [ ] **Step 1: 重构 HeroPage 为水墨风格**

创建水墨风格的首页：

```typescript
"use client";

import { Plus, BookOpen, Calendar, Trash2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProjectHistory } from "@/modules/project-history/use-project-history";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/types/picturebook";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

function CreateNewProjectCard() {
  const router = useRouter();
  return (
    <Card
      className="group cursor-pointer hover:shadow-ink transition-all duration-300 border-ink"
      onClick={() => router.push("/studio")}
    >
      <CardContent className="flex flex-col items-center justify-center py-16 px-8">
        <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors duration-300">
          <Plus className="w-10 h-10 text-primary" strokeWidth={1.5} />
        </div>
        <h3 className="text-2xl font-display mb-3">创建新项目</h3>
        <p className="text-muted-foreground text-center font-body">
          开始创作你的下一本精彩绘本
        </p>
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
    <Card className="overflow-hidden group border-ink hover:shadow-ink transition-all duration-300">
      <div
        className="aspect-[3/4] bg-gradient-to-br from-muted via-background to-muted flex items-center justify-center cursor-pointer relative"
        onClick={onOpen}
      >
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <BookOpen className="w-16 h-16 text-muted-foreground/30" strokeWidth={1} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-display mb-2">{project.title}</CardTitle>
            <CardDescription className="text-sm font-body">
              {PROJECT_STATUS_LABELS[project.projectStatus as ProjectStatus]}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/5"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans mb-4">
          <Calendar className="w-4 h-4" strokeWidth={1.5} />
          <span>
            更新于 {formatDistanceToNow(new Date(project.updatedAt), {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
        </div>
        <Button
          className="w-full font-display text-lg"
          onClick={onOpen}
        >
          继续创作
          <ArrowRight className="ml-2 w-5 h-5" strokeWidth={1.5} />
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
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-6xl md:text-7xl font-display mb-6 text-foreground">
            AI 绘本工作室
          </h1>
          <p className="text-xl text-muted-foreground font-body max-w-2xl mx-auto mb-8">
            用人工智能的力量，将你的想象变成精美的绘本
          </p>
          <div className="divider-ink max-w-md mx-auto" />
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <CreateNewProjectCard />

          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-ink animate-pulse">
                <div className="aspect-[3/4] bg-muted" />
                <CardHeader className="pb-2">
                  <div className="h-6 bg-muted rounded mb-2 w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-1/3 mb-4" />
                  <div className="h-10 bg-muted rounded" />
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
          <div className="text-center py-20">
            <div className="text-muted-foreground">
              <BookOpen className="w-20 h-20 mx-auto mb-6 opacity-20" strokeWidth={0.5} />
              <p className="text-xl font-body mb-2">还没有项目</p>
              <p className="font-sans">开始你的第一个创作吧！</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 测试首页渲染**

Run: `npm run dev` 访问 http://localhost:3000 检查首页样式

- [ ] **Step 3: Commit**

```bash
git add src/app/components/HeroPage.tsx
git commit -m "refactor: apply ink painting style to HeroPage"
```

---

### Task 4: 重构按钮组件样式

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: 创建水墨风格按钮组件**

更新 `button.tsx`：

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5",
        outline:
          "border-2 border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background",
        secondary:
          "bg-muted text-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        seal:
          "bg-primary text-primary-foreground relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 active:translate-y-0 font-display text-lg tracking-wider",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

- [ ] **Step 2: 测试不同按钮样式**

Run: `npm run dev` 测试各种按钮变体

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "refactor: apply ink painting style to button component"
```

---

### Task 5: 重构卡片组件样式

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: 创建水墨风格卡片组件**

更新 `card.tsx`：

```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:shadow-md",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-display leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground font-body", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

- [ ] **Step 2: 测试卡片样式**

Run: `npm run dev` 访问首页检查卡片样式

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "refactor: apply ink painting style to card component"
```

---

### Task 6: 重构 TopBar 导航栏

**Files:**
- Modify: `src/components/studio/TopBar.tsx`

- [ ] **Step 1: 更新 TopBar 为水墨风格**

```typescript
// 保持原有功能逻辑，仅更新样式类名
// 将 bg-background 改为 bg-paper
// 将 text-foreground 保持
// 将边框改为 border-border
// 将 hover 效果改为 hover:bg-muted
```

- [ ] **Step 2: 测试 TopBar 样式**

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/TopBar.tsx
git commit -m "refactor: apply ink painting style to TopBar"
```

---

## 阶段三：细节优化

### Task 7: 添加水墨特效 CSS 类

**Files:**
- Create: `src/app/ink-effects.css`

- [ ] **Step 1: 创建水墨特效 CSS 文件**

```css
/* 水墨晕染效果 */
.hover-ink-blur {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.hover-ink-blur:hover {
  box-shadow: 0 0 24px rgba(26, 26, 26, 0.08);
  transform: translateY(-2px);
}

/* 水墨扩散动画 */
@keyframes ink-spread {
  0% {
    transform: scale(0.95);
    opacity: 0;
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-ink-spread {
  animation: ink-spread 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 毛笔笔触动画 */
@keyframes brush-stroke {
  0% {
    transform: scaleX(0);
    transform-origin: left;
  }
  100% {
    transform: scaleX(1);
    transform-origin: left;
  }
}

.animate-brush-stroke {
  animation: brush-stroke 0.8s ease-out forwards;
}

/* 印章压印效果 */
.stamp-effect {
  position: relative;
}

.stamp-effect::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(197, 61, 67, 0.1) 0%, transparent 70%);
  pointer-events: none;
}

/* 水墨渐变边框 */
.border-ink-gradient {
  position: relative;
}

.border-ink-gradient::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(26, 26, 26, 0.1) 0%, transparent 50%, rgba(26, 26, 26, 0.05) 100%);
  pointer-events: none;
}

/* 宣纸纹理 */
.texture-paper {
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  background-blend-mode: soft-light;
}

/* 阴影层次 */
.shadow-ink-sm {
  box-shadow: 0 2px 8px rgba(26, 26, 26, 0.04);
}

.shadow-ink-md {
  box-shadow: 0 8px 24px rgba(26, 26, 26, 0.08);
}

.shadow-ink-lg {
  box-shadow: 0 16px 48px rgba(26, 26, 26, 0.12);
}

/* 朱红光晕 */
.glow-seal {
  box-shadow: 0 0 20px rgba(197, 61, 67, 0.3);
}

/* 加载动画 */
.loading-ink {
  position: relative;
  width: 40px;
  height: 40px;
}

.loading-ink::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: hsl(var(--primary));
  border-radius: 50%;
  animation: spin-ink 1s ease-in-out infinite;
}

@keyframes spin-ink {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 2: 在 layout.tsx 导入新样式**

```typescript
import "./globals.css"
import "./ink-effects.css"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/ink-effects.css
git add src/app/layout.tsx
git commit -m "refactor: add ink painting special effects CSS"
```

---

### Task 8: 优化表单输入组件

**Files:**
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/label.tsx`

- [ ] **Step 1: 更新输入框为水墨风格**

```typescript
// input.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 font-body",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

- [ ] **Step 2: 更新文本域**

```typescript
// textarea.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 font-body resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx src/components/ui/textarea.tsx
git commit -m "refactor: apply ink painting style to form components"
```

---

## 阶段四：测试与优化

### Task 9: 全面测试 UI 渲染

- [ ] **Step 1: 测试首页**

访问 http://localhost:3000 检查：
- 颜色是否符合设计
- 字体是否正确加载
- 卡片是否使用宣纸质感
- 按钮是否为水墨风格

- [ ] **Step 2: 测试工作室页面**

访问 http://localhost:3000/studio 检查：
- TopBar 导航栏样式
- 左侧边栏样式
- 内容区域背景

- [ ] **Step 3: 测试编辑器页面**

访问 http://localhost:3000/editor 检查：
- 编辑器布局
- 工具栏样式
- 画布区域

- [ ] **Step 4: 运行 Lint 检查**

```bash
npm run lint
```

- [ ] **Step 5: 运行 Build**

```bash
npm run build
```

---

### Task 10: 响应式测试与优化

- [ ] **Step 1: 测试不同屏幕尺寸**

测试以下断点：
- Mobile (< 640px)
- Tablet (640px - 1024px)
- Desktop (> 1024px)

- [ ] **Step 2: 优化响应式布局**

根据测试结果调整：
- 网格系统
- 字体大小
- 内边距

- [ ] **Step 3: Commit 最终更改**

```bash
git add -A
git commit -m "refactor: complete ink painting UI redesign"
```

---

## 实施总结

### 任务清单

**阶段一：基础样式重构**
- [ ] Task 1: 重构 globals.css 颜色变量
- [ ] Task 2: 更新 tailwind.config.ts 字体配置

**阶段二：核心组件重构**
- [ ] Task 3: 重构首页 HeroPage
- [ ] Task 4: 重构按钮组件样式
- [ ] Task 5: 重构卡片组件样式
- [ ] Task 6: 重构 TopBar 导航栏

**阶段三：细节优化**
- [ ] Task 7: 添加水墨特效 CSS 类
- [ ] Task 8: 优化表单输入组件

**阶段四：测试与优化**
- [ ] Task 9: 全面测试 UI 渲染
- [ ] Task 10: 响应式测试与优化

### 下一步

1. 执行所有任务
2. 测试所有页面
3. 修复发现的问题
4. 优化响应式布局
5. 最终提交

---

## 验收标准

1. ✅ 所有页面使用宣纸白背景
2. ✅ 标题使用书法字体
3. ✅ 主要操作按钮使用朱红色
4. ✅ 边框使用淡墨灰色
5. ✅ 无明显的 AI 科技感元素
6. ✅ 所有功能正常工作
7. ✅ 响应式布局正常
8. ✅ Build 成功
9. ✅ Lint 检查通过
