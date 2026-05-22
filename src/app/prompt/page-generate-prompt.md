# 页面画面生成提示词模板

## 专业版（用于AI生成）
```
{enhancerPrefix}
页码 Page: {pageIndex + 1}
故事情节 Story Content: {enrichedStoryText}
画面目标 Visual Goal: {visualGoal}
{characterLine}
{sceneLine}
```

## 变量说明
- `{enhancerPrefix}`: 由promptEnhancer生成的专业提示词前缀，包含风格、年龄、氛围、布局等要求
- `{pageIndex}`: 页码，从0开始，展示时+1
- `{enrichedStoryText}`: 注入了引用标签的故事文本
- `{visualGoal}`: 分镜中的画面目标描述
- `{characterLine}`: 角色相关信息，格式为：
  ```
  角色 Characters: 角色名1、角色名2
  角色细节 Character Details: 角色名1：描述1；角色名2：描述2
  ```
  无角色时省略
- `{sceneLine}`: 场景相关信息，格式为：
  ```
  场景 Scenes: 场景名1、场景名2
  场景细节 Scene Details: 场景名1：描述1；场景名2：描述2
  ```
  无场景时省略

## 增强器参数
- type: 'page'
- layout: 'golden'
- mood: 'warm'
