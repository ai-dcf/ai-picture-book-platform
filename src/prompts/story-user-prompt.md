# 故事生成用户提示词模板

```
绘本标题：{title}
{targetAgeLine}
{artStyleLine}
画面比例：{aspectRatio}
{pageCountLine}

请创作一个适合以上设定的儿童绘本故事。

{extraNote}
```

## 变量说明
- `{title}`: 绘本标题或故事主题
- `{targetAgeLine}`: 
  - 如果是自动：`目标年龄：请根据绘本主题自动分析最适合的年龄段`
  - 如果有具体值：`目标年龄：{targetAge}岁`
- `{artStyleLine}`:
  - 如果是自动：`画面风格：请根据绘本主题自动选择最适合的绘画风格`
  - 如果有具体值：`画面风格：{artStyle}`
- `{aspectRatio}`: 画面比例，例如 3:4、16:9 等
- `{pageCountLine}`:
  - 如果是自动：`总页数：请根据故事复杂度自动选择合适的页数（可选：8/12/16/24/32）`
  - 如果有具体值：`总页数：{pageCount}页`
- `{extraNote}`: 当有参数设置为自动时添加的额外说明
  - 目标年龄自动时添加：`- recommendedTargetAge: 你推荐的目标年龄段（只能是 '1-3'/'3-5'/'5-7'/'7-9' 中的一个）`
  - 艺术风格自动时添加：`- recommendedArtStyle: 你推荐的绘画风格（只能是现有风格列表中的一个）`
  - 页数自动时添加：`- recommendedPageCount: 你推荐的页数（只能是 8/12/16/24/32 中的一个数字）`
