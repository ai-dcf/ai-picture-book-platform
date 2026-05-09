"use client";
import { useStudio } from '@/hooks/use-studio';
import { simulateGeneration, simulateMultiple } from '@/lib/simulation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AssetItem, ASSET_STATUS_LABELS } from '@/types/picturebook';
import {
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  Users,
  Wand2,
} from 'lucide-react';
import { buildAssetPrompt } from '@/lib/prompt-builders';

function AssetStatusBadge({ asset }: { asset: AssetItem }) {
  return (
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-body',
      asset.status === 'official_confirmed' && 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
      asset.status === 'candidates_generated' && 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
      asset.status === 'not_generated' && 'bg-muted text-muted-foreground',
      (asset.status === 'pending_update' || asset.status === 'review') && 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    )}>
      {ASSET_STATUS_LABELS[asset.status]}
    </span>
  );
}

function AssetPromptEditor({
  asset,
  assetType,
}: {
  asset: AssetItem;
  assetType: 'characters' | 'scenes';
}) {
  const { state, dispatch, triggerSave } = useStudio();

  function handleDescChange(description: string) {
    dispatch({ type: 'UPDATE_ASSET_DESCRIPTION', payload: { type: assetType, id: asset.id, description } });
    triggerSave();
  }

  function handlePromptChange(prompt: string) {
    dispatch({ type: 'UPDATE_ASSET_PROMPT', payload: { type: assetType, id: asset.id, prompt } });
    triggerSave();
  }

  function handleResetPrompt() {
    dispatch({
      type: 'UPDATE_ASSET_PROMPT',
      payload: {
        type: assetType,
        id: asset.id,
        prompt: buildAssetPrompt({
          kind: assetType === 'characters' ? 'character' : 'scene',
          name: asset.name,
          description: asset.description,
          projectInfo: state.projectInfo,
        }),
        userEdited: false,
      },
    });
    triggerSave();
  }

  return (
    <>
      <Textarea
        value={asset.description}
        onChange={e => handleDescChange(e.target.value)}
        placeholder={assetType === 'characters' ? '描述角色外观、服饰、气质与关键特征…' : '描述场景氛围、空间元素与时代背景…'}
        className="font-body text-xs resize-none min-h-[56px]"
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-body text-muted-foreground">素材提示词</p>
          <button
            type="button"
            onClick={handleResetPrompt}
            className="text-[11px] text-primary font-body hover:underline"
          >
            重置系统提示词
          </button>
        </div>
        <Textarea
          value={asset.prompt || ''}
          onChange={e => handlePromptChange(e.target.value)}
          placeholder="系统会自动生成素材提示词，你也可以继续编辑…"
          className="font-body text-xs resize-none min-h-[104px]"
        />
      </div>
    </>
  );
}

function LoadingTiles({ count = 3, aspect = 'square' }: { count?: number; aspect?: 'square' | 'video' }) {
  return (
    <div className={cn('grid gap-2', count === 1 ? 'grid-cols-1' : 'grid-cols-3')}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'rounded-lg bg-muted overflow-hidden relative',
            aspect === 'video' ? 'aspect-video' : 'aspect-square',
          )}
          style={{ animationDelay: `${index * 0.15}s` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent animate-shimmer bg-[length:200%_100%]" />
        </div>
      ))}
    </div>
  );
}

function EmptyPreview({
  label,
  aspect = 'square',
}: {
  label: string;
  aspect?: 'square' | 'video';
}) {
  return (
    <div className={cn(
      'rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 bg-muted/30',
      aspect === 'video' ? 'aspect-video' : 'aspect-square',
    )}>
      <ImageIcon className="w-6 h-6 text-muted-foreground" />
      <span className="text-xs font-body text-muted-foreground">{label}</span>
    </div>
  );
}

function CharacterCard({ asset }: { asset: AssetItem }) {
  const { state, dispatch, triggerSave } = useStudio();
  const hasPrompt = Boolean((asset.prompt || '').trim());
  const baseConfirmed = Boolean(asset.officialImageUrl && asset.baseImageUrl && asset.officialImageUrl === asset.baseImageUrl);
  const turnaroundReady = asset.turnaroundImages.length > 0;

  function ensurePrompt() {
    if (hasPrompt) return;
    dispatch({
      type: 'UPDATE_ASSET_PROMPT',
      payload: {
        type: 'characters',
        id: asset.id,
        prompt: buildAssetPrompt({
          kind: 'character',
          name: asset.name,
          description: asset.description,
          projectInfo: state.projectInfo,
        }),
        userEdited: false,
      },
    });
  }

  async function handleGenerateBase() {
    ensurePrompt();
    dispatch({
      type: 'SET_ASSET_GENERATING',
      payload: { type: 'characters', id: asset.id, generating: true, phase: 'character_base' },
    });
    const imageUrl = await simulateGeneration(2200);
    dispatch({ type: 'SET_CHARACTER_BASE_IMAGE', payload: { id: asset.id, imageUrl } });
    triggerSave();
  }

  function handleConfirmBase() {
    dispatch({ type: 'CONFIRM_CHARACTER_BASE', payload: { id: asset.id } });
    triggerSave();
  }

  async function handleGenerateTurnaround() {
    ensurePrompt();
    dispatch({
      type: 'SET_ASSET_GENERATING',
      payload: { type: 'characters', id: asset.id, generating: true, phase: 'character_turnaround' },
    });
    const images = await simulateMultiple(3, 2600);
    dispatch({ type: 'SET_CHARACTER_TURNAROUNDS', payload: { id: asset.id, images } });
    triggerSave();
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-card shadow-card space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-body font-semibold text-foreground flex-1 truncate">{asset.name}</h4>
        <AssetStatusBadge asset={asset} />
      </div>

      <AssetPromptEditor asset={asset} assetType="characters" />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-body text-muted-foreground">基础形象</p>
            {baseConfirmed && (
              <div className="flex items-center gap-1 text-[11px] text-green-600 font-body">
                <Check className="w-3 h-3" />
                已确认
              </div>
            )}
          </div>

          {asset.generating && asset.generatingPhase === 'character_base' ? (
            <LoadingTiles count={1} />
          ) : asset.baseImageUrl ? (
            <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
              <img src={asset.baseImageUrl} alt={`${asset.name} 基础形象`} className="w-full h-full object-cover" />
            </div>
          ) : (
            <EmptyPreview label="暂无基础形象图" />
          )}

          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={handleGenerateBase}
              disabled={asset.generating}
              size="sm"
              variant={asset.baseImageUrl ? 'outline' : 'default'}
              className={cn(
                'w-full gap-2 font-body text-xs',
                !asset.baseImageUrl && 'gradient-hero text-primary-foreground border-0'
              )}
            >
              {asset.generating && asset.generatingPhase === 'character_base' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成基础形象中…</>
              ) : (
                <><Wand2 className="w-3.5 h-3.5" />{asset.baseImageUrl ? '重新生成基础形象' : '生成基础形象'}</>
              )}
            </Button>

            <Button
              onClick={handleConfirmBase}
              disabled={!asset.baseImageUrl || asset.generating}
              size="sm"
              variant="secondary"
              className="w-full gap-2 font-body text-xs"
            >
              <Check className="w-3.5 h-3.5" />
              确认基础形象
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-body text-muted-foreground">三视图</p>
            {turnaroundReady && (
              <div className="flex items-center gap-1 text-[11px] text-green-600 font-body">
                <Sparkles className="w-3 h-3" />
                已生成
              </div>
            )}
          </div>

          {asset.generating && asset.generatingPhase === 'character_turnaround' ? (
            <LoadingTiles count={3} />
          ) : turnaroundReady ? (
            <div className="grid grid-cols-3 gap-2">
              {asset.turnaroundImages.map((url, index) => (
                <div key={index} className="space-y-1">
                  <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                    <img src={url} alt={`${asset.name} 视图 ${index + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[11px] text-center font-body text-muted-foreground">
                    {['正面', '侧面', '背面'][index] || `视图 ${index + 1}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {['正面', '侧面', '背面'].map(label => (
                <div key={label} className="space-y-1">
                  <EmptyPreview label={label} />
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleGenerateTurnaround}
            disabled={!baseConfirmed || asset.generating}
            size="sm"
            variant={turnaroundReady ? 'outline' : 'default'}
            className={cn(
              'w-full gap-2 font-body text-xs',
              !turnaroundReady && 'gradient-hero text-primary-foreground border-0'
            )}
          >
            {asset.generating && asset.generatingPhase === 'character_turnaround' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成三视图中…</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" />{turnaroundReady ? '重新生成三视图' : '确认基础形象，生成三视图'}</>
            )}
          </Button>

          <p className="text-[11px] font-body text-muted-foreground">
            先确认基础形象，再生成三视图，确保后续逐页生成保持角色一致。
          </p>
        </div>
      </div>
    </div>
  );
}

function SceneCard({ asset }: { asset: AssetItem }) {
  const { state, dispatch, triggerSave } = useStudio();
  const hasPrompt = Boolean((asset.prompt || '').trim());

  function ensurePrompt() {
    if (hasPrompt) return;
    dispatch({
      type: 'UPDATE_ASSET_PROMPT',
      payload: {
        type: 'scenes',
        id: asset.id,
        prompt: buildAssetPrompt({
          kind: 'scene',
          name: asset.name,
          description: asset.description,
          projectInfo: state.projectInfo,
        }),
        userEdited: false,
      },
    });
  }

  async function handleGenerateCandidates() {
    ensurePrompt();
    dispatch({
      type: 'SET_ASSET_GENERATING',
      payload: { type: 'scenes', id: asset.id, generating: true, phase: 'scene_candidates' },
    });
    const images = await simulateMultiple(3, 2500);
    dispatch({ type: 'SET_SCENE_CANDIDATES', payload: { id: asset.id, candidates: images } });
    triggerSave();
  }

  function handleSetOfficial(index: number) {
    dispatch({ type: 'SET_SCENE_OFFICIAL', payload: { id: asset.id, index } });
    triggerSave();
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-card shadow-card space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-body font-semibold text-foreground flex-1 truncate">{asset.name}</h4>
        <AssetStatusBadge asset={asset} />
      </div>

      <AssetPromptEditor asset={asset} assetType="scenes" />

      <Button
        onClick={handleGenerateCandidates}
        disabled={asset.generating}
        size="sm"
        variant={asset.candidates.length > 0 ? 'outline' : 'default'}
        className={cn(
          'w-full gap-2 font-body text-xs',
          asset.candidates.length === 0 && 'gradient-hero text-primary-foreground border-0'
        )}
      >
        {asset.generating ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成候选图中…</>
        ) : (
          <><Wand2 className="w-3.5 h-3.5" />{asset.candidates.length > 0 ? '重新生成候选图' : '生成 3 张候选图'}</>
        )}
      </Button>

      {asset.generating && asset.generatingPhase === 'scene_candidates' ? (
        <LoadingTiles count={3} aspect="video" />
      ) : asset.candidates.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-body text-muted-foreground">选择正式版本</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {asset.candidates.map((url, index) => (
              <button
                key={index}
                onClick={() => handleSetOfficial(index)}
                className={cn(
                  'rounded-lg overflow-hidden relative border-2 transition-smooth group',
                  asset.officialIndex === index
                    ? 'border-primary shadow-glow'
                    : 'border-transparent hover:border-primary/40'
                )}
              >
                <div className="aspect-video">
                  <img src={url} alt={`${asset.name} 候选图 ${index + 1}`} className="w-full h-full object-cover" />
                </div>
                {asset.officialIndex === index && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
          {asset.officialIndex !== null ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-body">
              <Star className="w-3 h-3 fill-current" />
              已选定正式版本（候选图 {asset.officialIndex + 1}）
            </div>
          ) : (
            <p className="text-xs text-muted-foreground font-body">点击候选图设为正式版本</p>
          )}
        </div>
      ) : (
        <EmptyPreview label="暂无候选图" aspect="video" />
      )}
    </div>
  );
}

export default function Stage4Assets() {
  const { state, dispatch, triggerSave } = useStudio();
  const { assets } = state;

  const charactersReady = assets.characters.every(asset => Boolean(asset.baseImageUrl));
  const allOfficialSet = charactersReady;
  const hasAssets = assets.characters.length > 0 || assets.scenes.length > 0;

  function handleConfirm() {
    dispatch({ type: 'COMPLETE_STAGE', payload: 4 });
    triggerSave();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ImageIcon className="w-4 h-4 text-primary" />
          <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">阶段 4 · 素材设定</span>
        </div>
        <h2 className="font-display text-2xl text-foreground">素材设定</h2>
        <p className="text-sm font-body text-muted-foreground mt-1">
          角色基础形象为必填项，三视图和场景视图为选填项；所有角色完成基础形象生成后即可进入逐页生成
        </p>
      </div>

      {!hasAssets ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2 max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-body text-muted-foreground">素材将从故事阶段的角色和场景清单中自动导入</p>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="characters" className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-fit mb-4">
            <TabsTrigger value="characters" className="gap-1.5 font-body">
              <Users className="w-3.5 h-3.5" />
              角色设定
              <span className="ml-1 text-xs text-muted-foreground">({assets.characters.length})</span>
            </TabsTrigger>
            <TabsTrigger value="scenes" className="gap-1.5 font-body">
              <MapPin className="w-3.5 h-3.5" />
              场景设定
              <span className="ml-1 text-xs text-muted-foreground">({assets.scenes.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="characters" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full -mr-4 pr-4">
              <div className="grid grid-cols-1 gap-4 pb-4">
                {assets.characters.map(asset => (
                  <CharacterCard key={asset.id} asset={asset} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="scenes" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full -mr-4 pr-4">
              <div className="grid grid-cols-1 gap-4 pb-4">
                {assets.scenes.map(asset => (
                  <SceneCard key={asset.id} asset={asset} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}

      <div className="pt-4 mt-auto border-t border-border flex items-center justify-between gap-4">
        <div className="text-xs font-body text-muted-foreground">
          {allOfficialSet ? (
            <span className="text-green-600">所有角色基础形象已生成，可进入逐页生成</span>
          ) : (
            <span className="text-amber-600">所有角色都需要先生成基础形象；三视图和场景视图可稍后补充</span>
          )}
        </div>
        <Button
          onClick={handleConfirm}
          disabled={!allOfficialSet}
          className={cn(
            'gap-2 font-body gradient-hero text-primary-foreground border-0',
            !allOfficialSet && 'opacity-50 cursor-not-allowed'
          )}
        >
          确认素材，进入逐页生成
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
