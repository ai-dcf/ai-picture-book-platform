"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { useStudioGenerate } from '@/modules/studio/presentation/hooks/use-studio-generate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, ArrowRight, BookOpen, ChevronDown, ChevronUp, Loader2, MapPin, RefreshCw, Users, Wand2 } from 'lucide-react';
import { EmotionCurvePoint, ProjectInfo, StoryEntry, EMOTION_INTENSITY_MAP } from '@/types/picturebook';
import EmotionCurveChart from './EmotionCurveChart';



interface EntryCardProps {
  entry: StoryEntry;
  onDescChange: (desc: string) => void;
  colorClass: string;
}

function EntryCard({ entry, onDescChange, colorClass }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn('border rounded-lg overflow-hidden bg-card', colorClass)}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <span className="text-sm font-body font-medium text-foreground truncate">{entry.name}</span>
          {entry.userModified && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-body">已修改</span>
          )}
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <Textarea
            value={entry.description}
            onChange={e => onDescChange(e.target.value)}
            placeholder="输入描述（外貌特征、性格等）…"
            className="font-body text-xs resize-none min-h-[64px]"
          />
          <p className="text-xs text-muted-foreground font-body mt-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            修改描述可能影响后续分镜拆页与素材设定
          </p>
        </div>
      )}
      {!expanded && entry.description && (
        <p className="px-3 pb-2 text-xs font-body text-muted-foreground truncate">{entry.description}</p>
      )}
    </div>
  );
}

export default function Stage2Story() {
  const { state, dispatch, triggerSave } = useStudio();
  const { story, projectInfo, stageStatuses } = state;
  const { generateStory, error, clearError, getErrorMessage } = useStudioGenerate();
  const [selectedEmotionIndex, setSelectedEmotionIndex] = useState<number | null>(null);
  const autoTriggeredRef = useRef(false);

  const handleGenerate = useCallback(async () => {
    dispatch({ type: 'SET_STORY_GENERATING', payload: true });
    clearError();
    const result = await generateStory(projectInfo);
    if (result) {
      dispatch({ type: 'SET_STORY', payload: { ...result, generating: false } });
      
      // 更新自动推荐的参数
      const updates: Partial<ProjectInfo> = {};
      if (result.recommendedTargetAge && projectInfo.targetAge === 'auto') {
        updates.targetAge = result.recommendedTargetAge;
      }
      if (result.recommendedArtStyle && projectInfo.artStyle === 'auto') {
        updates.artStyle = result.recommendedArtStyle;
      }
      if (result.recommendedPageCount && projectInfo.pageCount === 'auto') {
        updates.pageCount = result.recommendedPageCount;
      }
      
      if (Object.keys(updates).length > 0) {
        dispatch({ type: 'SET_PROJECT_INFO', payload: updates });
      }
      
      triggerSave();
    } else {
      dispatch({ type: 'SET_STORY_GENERATING', payload: false });
    }
  }, [dispatch, projectInfo, generateStory, clearError, triggerSave]);

  const hasStoryResult = useMemo(
    () =>
      story.storyOutline.trim().length > 0 ||
      story.characters.length > 0 ||
      story.scenes.length > 0 ||
      story.emotionCurve.length > 0,
    [story]
  );

  useEffect(() => {
    if (
      autoTriggeredRef.current ||
      story.generating ||
      hasStoryResult ||
      projectInfo.title.trim().length === 0
    ) {
      return;
    }

    autoTriggeredRef.current = true;
    void handleGenerate();
  }, [handleGenerate, hasStoryResult, projectInfo.title, story.generating]);

  function handleConfirm() {
    dispatch({ type: 'COMPLETE_STAGE', payload: 2 });
    triggerSave();
  }

  function handleEmotionPointClick(index: number) {
    setSelectedEmotionIndex(selectedEmotionIndex === index ? null : index);
  }

  function handleEmotionChange(index: number, field: keyof EmotionCurvePoint, value: string | number | boolean) {
    const curve = [...story.emotionCurve];
    const point = { ...curve[index], [field]: value };
    if (field === 'emotion' && typeof value === 'string') {
      point.intensity = EMOTION_INTENSITY_MAP[value] ?? point.intensity;
    }
    curve[index] = point;
    dispatch({ type: 'SET_STORY', payload: { emotionCurve: curve } });
    triggerSave();
  }

  const canConfirm =
    story.characters.length > 0 &&
    story.storyOutline.trim().length > 0 &&
    story.emotionCurve.length > 0 &&
    story.scenes.length > 0;

  const hasDownstream = stageStatuses[3] !== 'idle' || stageStatuses[4] !== 'idle';

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">阶段 2 · 故事架构</span>
        </div>
        <h2 className="font-display text-2xl text-foreground">故事架构</h2>
        <p className="text-sm font-body text-muted-foreground mt-1">AI 将根据你的设定生成完整故事结构，你可以编辑描述但不可新增或删除角色/场景</p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          onClick={handleGenerate}
          disabled={story.generating}
          className="gap-2 font-body gradient-hero text-primary-foreground border-0"
        >
          {story.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {story.generating ? '生成中…' : hasStoryResult ? '再次手动触发生成' : '一键生成故事架构'}
        </Button>
        {hasStoryResult && (
          <Button onClick={handleGenerate} disabled={story.generating} variant="outline" className="gap-2 font-body">
            <RefreshCw className="w-3.5 h-3.5" />
            重新生成
          </Button>
        )}
      </div>

      {error && !story.generating && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{getErrorMessage(error)}</span>
          <Button onClick={handleGenerate} size="sm" variant="outline" className="gap-1.5 font-body text-xs h-7 border-red-200 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50">
            <RefreshCw className="w-3 h-3" />
            重试
          </Button>
        </div>
      )}

      {story.generating && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center mx-auto animate-pulse-soft">
              <Wand2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">正在构思故事架构，请稍候…</p>
          </div>
        </div>
      )}

      {!story.generating && hasStoryResult && (
        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-body font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs flex items-center justify-center font-display">1</span>
                故事大纲
              </h3>
              <Textarea
                value={story.storyOutline}
                onChange={e => { dispatch({ type: 'SET_STORY', payload: { storyOutline: e.target.value } }); triggerSave(); }}
                className="font-body text-sm resize-none min-h-[120px]"
                placeholder="输入故事大纲…"
              />
            </section>

            <section>
              <h3 className="text-sm font-body font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs flex items-center justify-center font-display">2</span>
                情绪曲线
                <span className="text-xs text-muted-foreground font-normal ml-1">（点击节点可编辑情绪和强度）</span>
              </h3>
              <EmotionCurveChart
                data={story.emotionCurve}
                onPointClick={handleEmotionPointClick}
                selectedIndex={selectedEmotionIndex}
                editable
              />

              {selectedEmotionIndex !== null && story.emotionCurve[selectedEmotionIndex] && (
                <div className="mt-3 p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-body font-medium text-foreground">
                      {story.emotionCurve[selectedEmotionIndex].label}
                    </span>
                    <span className="text-xs font-body text-muted-foreground">—</span>
                    <span className="text-xs font-body font-medium text-primary">
                      {story.emotionCurve[selectedEmotionIndex].emotion}
                    </span>
                    <span className="text-[10px] font-body text-muted-foreground ml-1">
                      (强度: {story.emotionCurve[selectedEmotionIndex].intensity > 0 ? '+' : ''}{story.emotionCurve[selectedEmotionIndex].intensity})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-body text-muted-foreground">情绪词</label>
                      <select
                        value={story.emotionCurve[selectedEmotionIndex].emotion}
                        onChange={e => handleEmotionChange(selectedEmotionIndex, 'emotion', e.target.value)}
                        className="w-full h-8 text-xs font-body rounded-md border border-border bg-background px-2"
                      >
                        {Object.keys(EMOTION_INTENSITY_MAP).map(e => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-body text-muted-foreground">情绪强度 (-6 ~ +6)</label>
                      <input
                        type="range"
                        min={-6}
                        max={6}
                        step={1}
                        value={story.emotionCurve[selectedEmotionIndex].intensity}
                        onChange={e => handleEmotionChange(selectedEmotionIndex, 'intensity', Number(e.target.value))}
                        className="w-full h-2 accent-primary"
                      />
                      <div className="flex justify-between text-[9px] font-body text-muted-foreground">
                        <span>负面</span>
                        <span className="font-medium text-foreground">{story.emotionCurve[selectedEmotionIndex].intensity}</span>
                        <span>正面</span>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-[10px] font-body text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={story.emotionCurve[selectedEmotionIndex].isTurningPoint}
                      onChange={e => handleEmotionChange(selectedEmotionIndex, 'isTurningPoint', e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-amber-500"
                    />
                    标记为关键转折点
                  </label>

                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEmotionIndex(null)}
                      className="text-xs font-body h-7"
                    >
                      关闭编辑
                    </Button>
                  </div>
                </div>
              )}

              {story.emotionCurve.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-body text-muted-foreground">情节节点一览</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {story.emotionCurve.map((point, i) => (
                      <button
                        key={i}
                        onClick={() => handleEmotionPointClick(i)}
                        className={cn(
                          'px-2.5 py-1.5 rounded-lg border text-xs font-body transition-smooth',
                          selectedEmotionIndex === i
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-foreground hover:border-primary/50',
                          point.isTurningPoint && 'border-amber-300 dark:border-amber-700'
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground block">{point.label}</span>
                        <span className="font-medium">
                          {point.isTurningPoint && '⚡ '}{point.emotion}
                          <span className="text-[9px] text-muted-foreground ml-1">
                            ({point.intensity > 0 ? '+' : ''}{point.intensity})
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-body font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs flex items-center justify-center font-display">3</span>
                <Users className="w-3.5 h-3.5" />
                角色设定
                <span className="text-xs text-muted-foreground font-normal ml-1">（可编辑描述，不可新增/删除）</span>
              </h3>
              <div className="space-y-2">
                {story.characters.map(c => (
                  <EntryCard
                    key={c.name}
                    entry={c}
                    colorClass="border-primary/20"
                    onDescChange={desc => { dispatch({ type: 'UPDATE_CHARACTER_DESC', payload: { name: c.name, description: desc } }); triggerSave(); }}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-body font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs flex items-center justify-center font-display">4</span>
                <MapPin className="w-3.5 h-3.5" />
                场景清单
                <span className="text-xs text-muted-foreground font-normal ml-1">（可编辑描述，不可新增/删除）</span>
              </h3>
              <div className="space-y-2">
                {story.scenes.map(s => (
                  <EntryCard
                    key={s.name}
                    entry={s}
                    colorClass="border-accent/20"
                    onDescChange={desc => { dispatch({ type: 'UPDATE_SCENE_DESC', payload: { name: s.name, description: desc } }); triggerSave(); }}
                  />
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      )}

      {!story.generating && !hasStoryResult && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">首次进入本阶段会自动生成故事架构；如需重试，也可以手动触发生成</p>
          </div>
        </div>
      )}

      {hasStoryResult && !story.generating && (
        <div className="pt-4 mt-auto border-t border-border flex items-center justify-between gap-4">
          <div className="text-xs font-body text-muted-foreground">
            {canConfirm ? (
              <span>确认后将进入分镜拆页阶段</span>
            ) : (
              <span className="text-amber-600">请确保所有4项核心产出已完成</span>
            )}
            {hasDownstream && (
              <span className="text-amber-600 block mt-1">修改将使下游分镜拆页和素材设定标记为待复查</span>
            )}
          </div>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              'gap-2 font-body gradient-hero text-primary-foreground border-0',
              !canConfirm && 'opacity-50 cursor-not-allowed'
            )}
          >
            确认故事架构，进入分镜拆页
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
