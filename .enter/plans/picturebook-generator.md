# 修复：阶段2角色/场景清单增加描述字段

## Context
当前阶段2的角色清单和场景清单只保存了名称（`string[]`）。
需求要求每个角色/场景都有"名称 + 描述"，且描述应在"一键生成故事草案"时一并由 AI 生成。

---

## 受影响文件

| 文件 | 改动摘要 |
|---|---|
| `src/types/picturebook.ts` | 新增 `StoryEntry` 接口；更新 `StoryData.characters/scenes` 类型 |
| `src/context/StudioContext.tsx` | 更新 Action payload 类型；更新 ADD/REMOVE 以及 INIT_ASSETS reducer |
| `src/components/studio/stages/Stage2Story.tsx` | 更新 mock 数据、显示方式（卡片代替 Badge）、新增表单 |
| `src/components/studio/stages/Stage4Pages.tsx` | 角色/场景选择按钮改用 `.name` 字段 |

---

## 详细改动

### 1. `src/types/picturebook.ts`
新增：
```ts
export interface StoryEntry {
  name: string;
  description: string;
}
```
修改 `StoryData`：
```ts
characters: StoryEntry[];
scenes: StoryEntry[];
```

### 2. `src/context/StudioContext.tsx`
- 导入 `StoryEntry`
- `ADD_CHARACTER` payload：`StoryEntry`（不再是 `string`）
- `ADD_SCENE` payload：`StoryEntry`
- `REMOVE_CHARACTER` payload：`string`（仍按 name 删除）
- `REMOVE_SCENE` payload：`string`
- 新增 Action：`UPDATE_CHARACTER_DESC { name: string; description: string }` 和 `UPDATE_SCENE_DESC { name: string; description: string }`
- `ADD_CHARACTER` reducer：按 `.name` 去重，推入 `StoryEntry`
- `ADD_SCENE` reducer：同上
- `REMOVE_CHARACTER` reducer：按 `.name` 过滤
- `REMOVE_SCENE` reducer：同上
- `INIT_ASSETS` reducer：`entry.name` + `entry.description` 预填描述（这样阶段3的描述框会有初始值）
- `SET_ASSET_OFFICIAL` reducer 查名称处：改用 `.name`

### 3. `src/components/studio/stages/Stage2Story.tsx`
- Mock 数据更新：characters/scenes 改为带 description 的对象
  ```ts
  characters: [
    { name: '小兔子', description: '白色毛发，大耳朵，总是背着红色小书包，天真活泼' },
    { name: '熊猫老师', description: '黑白相间的大熊猫，戴着圆框眼镜，声音温柔' },
    { name: '松鼠小明', description: '棕色松鼠，大尾巴，爱囤坚果，机灵好动' },
  ]
  ```
- 角色/场景不再用 Badge，改为**可展开的小卡片**，每张卡片含：
  - 顶部：名称 + 删除按钮
  - 展开后：描述文本域（可编辑）
- 新增表单：两个字段（名称 + 描述）+ 添加按钮
- dispatch `ADD_CHARACTER` / `ADD_SCENE` 时传递 `StoryEntry`
- dispatch `UPDATE_CHARACTER_DESC` / `UPDATE_SCENE_DESC` 当描述框 onChange

### 4. `src/components/studio/stages/Stage4Pages.tsx`
- `story.characters.map(c => ...)` → `story.characters.map(c => c.name)`（用于选择 tag 显示）
- `story.scenes.map(s => ...)` → `story.scenes.map(s => s.name)`

---

## 验证
1. 点击"一键生成全书故事" → 角色清单和场景清单均显示名称 + 描述
2. 手动修改描述 → 自动保存触发
3. 手动新增角色/场景 → 需填写名称和描述
4. 删除角色/场景 → 正常删除
5. 进入阶段3 → 每个角色/场景的描述文本框已预填了阶段2的描述
6. 进入阶段4 → 角色/场景选择按钮正常显示名称
