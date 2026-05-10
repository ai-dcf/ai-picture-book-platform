import type { ProjectInfo, StoryData } from "@/types/picturebook";

export function buildStoryboardSystemPrompt(pageCount: number): string {
  return `你是一位专业绘本分镜导演。请根据故事内容为 ${pageCount} 页绘本创作分镜脚本。

你必须严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "pages": [
    {
      "text": "本页正文文字",
      "visualGoal": "画面视觉目标描述",
      "pageTurnMotivation": "suspense|emotion|discovery|none",
      "characterRefs": ["出现的角色名"],
      "sceneRefs": ["出现的场景名"]
    }
  ]
}

要求：
- 输出恰好 ${pageCount} 页
- 每页文字 20-80 字，适合儿童阅读节奏
- 画面目标具体可执行，包含构图、色调、氛围
- pageTurnMotivation 驱动翻页欲望
- characterRefs 和 sceneRefs 必须引用故事中的角色和场景名称`;
}

export function buildStoryboardUserPrompt(story: StoryData, projectInfo: ProjectInfo): string {
  const characterList = story.characters
    .map((c) => `${c.name}：${c.description}`)
    .join("；");
  const sceneList = story.scenes
    .map((s) => `${s.name}：${s.description}`)
    .join("；");

  return [
    `故事概要：${story.oneLineStory}`,
    "",
    `角色：${characterList}`,
    `场景：${sceneList}`,
    "",
    `故事大纲：${story.storyOutline}`,
    "",
    `目标年龄：${projectInfo.targetAge}岁，画面风格：${projectInfo.artStyle}，总页数：${projectInfo.pageCount}页`,
    "",
    "请为每页创作分镜脚本。",
  ].join("\n");
}
