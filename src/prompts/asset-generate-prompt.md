# 角色/场景资产生成提示词模板

## 专业版（用于AI生成）
```
{enhancerPrefix}
主体 Subject: {name}
描述 Description: {description}
```

## 用户友好版（用于前端展示）
```
{friendlyPrefix}
名称：{name}
描述：{description}
{characterNote}
```

## 变量说明
- `{enhancerPrefix}`: 由promptEnhancer生成的专业提示词前缀，包含风格、年龄、氛围、布局等要求
- `{name}`: 角色或场景名称
- `{description}`: 角色或场景的详细描述
- `{friendlyPrefix}`: 由promptEnhancer生成的用户友好提示词前缀
- `{characterNote}`: 角色专属说明，固定为 `要求全身照片。`（仅角色资产有）

## 增强器参数
- 角色类型：
  - type: 'character'
  - layout: 'centered'
  - mood: 'warm'
- 场景类型：
  - type: 'scene'
  - layout: 'centered'
  - mood: 'warm'
