"use client";
import { useStudio } from '@/hooks/use-studio';
import { simulateGeneration } from '@/lib/simulation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TextAlign, FontWeight } from '@/types/picturebook';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  RefreshCw,
  RotateCcw,
  Save,
  CheckCircle2,
  Loader2,
  Wand2,
  Type,
  Palette,
} from 'lucide-react';
import { useState } from 'react';

const COLOR_PRESETS = [
  { label: '深色', value: '#1a1008' },
  { label: '浅色', value: '#fdf6ec' },
  { label: '白色', value: '#ffffff' },
  { label: '珊瑚', value: '#c84e2a' },
  { label: '深蓝', value: '#1a3a5c' },
  { label: '翠绿', value: '#2a7a5a' },
];

interface Props {
  pageIndex: number;
}

export default function EditorControlPanel({ pageIndex }: Props) {
  const { state, dispatch, triggerSave } = useStudio();
  const editor = state.editorStates[pageIndex];
  const page = state.pages[pageIndex];
  const [regenerating, setRegenerating] = useState(false);
  const [prevImage, setPrevImage] = useState<string | null>(null);

  function updateText(text: string) {
    dispatch({ type: 'UPDATE_EDITOR_STATE', payload: { pageIndex, state: { textContent: text } } });
    triggerSave();
  }

  function updateStyle(patch: Partial<typeof editor.style>) {
    dispatch({ type: 'UPDATE_EDITOR_STYLE', payload: { pageIndex, style: patch } });
    triggerSave();
  }

  function updateLayout(patch: Partial<typeof editor.layout>) {
    dispatch({ type: 'UPDATE_EDITOR_LAYOUT', payload: { pageIndex, layout: patch } });
    triggerSave();
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setPrevImage(page?.imageUrl || null);
    const url = await simulateGeneration(2500);
    dispatch({ type: 'SET_PAGE_IMAGE', payload: { index: pageIndex, imageUrl: url } });
    triggerSave();
    setRegenerating(false);
  }

  function handleRestore() {
    if (!prevImage) return;
    dispatch({ type: 'SET_PAGE_IMAGE', payload: { index: pageIndex, imageUrl: prevImage } });
    setPrevImage(null);
    triggerSave();
  }

  function handleConfirm() {
    dispatch({ type: 'CONFIRM_EDITOR_PAGE', payload: pageIndex });
    triggerSave();
  }

  function handleSave() {
    triggerSave();
  }

  const isConfirmed = editor.confirmed;

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Text content */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-body font-semibold text-foreground uppercase tracking-wide">文案内容</span>
            </div>
            <Textarea
              value={editor.textContent}
              onChange={e => updateText(e.target.value)}
              className="font-body text-sm resize-none min-h-[88px]"
              placeholder="在此输入绘本文字…"
            />
          </section>

          {/* Text style */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-body font-semibold text-foreground uppercase tracking-wide">文字样式</span>
            </div>

            {/* Font size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-body text-muted-foreground">字号</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateStyle({ fontSize: Math.max(10, editor.style.fontSize - 2) })}
                    className="w-6 h-6 rounded border border-border flex items-center justify-center text-xs hover:bg-muted transition-smooth font-body"
                  >-</button>
                  <span className="text-sm font-body font-medium w-8 text-center">{editor.style.fontSize}</span>
                  <button
                    onClick={() => updateStyle({ fontSize: Math.min(48, editor.style.fontSize + 2) })}
                    className="w-6 h-6 rounded border border-border flex items-center justify-center text-xs hover:bg-muted transition-smooth font-body"
                  >+</button>
                </div>
              </div>
              <Slider
                min={10}
                max={48}
                step={1}
                value={[editor.style.fontSize]}
                onValueChange={([v]) => updateStyle({ fontSize: v })}
                className="w-full"
              />
            </div>

            {/* Font weight */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-body text-muted-foreground">字重</span>
              <div className="flex gap-1">
                {(['normal', 'bold'] as FontWeight[]).map(w => (
                  <button
                    key={w}
                    onClick={() => updateStyle({ fontWeight: w })}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-body border transition-smooth',
                      editor.style.fontWeight === w
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-primary/50'
                    )}
                  >
                    {w === 'normal' ? '常规' : <><Bold className="w-3 h-3 inline mr-0.5" />加粗</>}
                  </button>
                ))}
              </div>
            </div>

            {/* Alignment */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-body text-muted-foreground">对齐</span>
              <div className="flex gap-1">
                {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as [TextAlign, React.ElementType][]).map(([align, Icon]) => (
                  <button
                    key={align}
                    onClick={() => updateStyle({ textAlign: align })}
                    className={cn(
                      'w-7 h-7 rounded border transition-smooth flex items-center justify-center',
                      editor.style.textAlign === align
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-primary/50 text-muted-foreground'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <span className="text-xs font-body text-muted-foreground">文字颜色</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => updateStyle({ textColor: c.value })}
                    title={c.label}
                    className={cn(
                      'w-6 h-6 rounded-full border-2 transition-smooth',
                      editor.style.textColor === c.value ? 'border-primary scale-110 shadow-glow' : 'border-transparent hover:border-primary/40'
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <input
                  type="color"
                  value={editor.style.textColor}
                  onChange={e => updateStyle({ textColor: e.target.value })}
                  className="w-6 h-6 rounded-full border border-border cursor-pointer overflow-hidden"
                  title="自定义颜色"
                />
              </div>
            </div>
          </section>

          {/* Text box layout */}
          <section className="space-y-3">
            <span className="text-xs font-body font-semibold text-foreground uppercase tracking-wide">文本框尺寸</span>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-body text-muted-foreground">宽度</span>
                <span className="text-xs font-body font-medium">{Math.round(editor.layout.w)}%</span>
              </div>
              <Slider
                min={15}
                max={100}
                step={1}
                value={[editor.layout.w]}
                onValueChange={([v]) => updateLayout({ w: v })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-body text-muted-foreground">高度</span>
                <span className="text-xs font-body font-medium">{Math.round(editor.layout.h)}%</span>
              </div>
              <Slider
                min={5}
                max={60}
                step={1}
                value={[editor.layout.h]}
                onValueChange={([v]) => updateLayout({ h: v })}
              />
            </div>
          </section>

          {/* Image actions */}
          <section className="space-y-2">
            <span className="text-xs font-body font-semibold text-foreground uppercase tracking-wide">插画操作</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex-1 gap-1.5 font-body text-xs"
              >
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {regenerating ? '重绘中…' : '重绘当前页'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                disabled={!prevImage || regenerating}
                className="gap-1.5 font-body text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                恢复上版
              </Button>
            </div>
          </section>
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button
          onClick={handleSave}
          variant="outline"
          className="w-full gap-2 font-body text-sm"
        >
          <Save className="w-3.5 h-3.5" />
          保存当前页
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isConfirmed}
          className={cn(
            'w-full gap-2 font-body text-sm',
            isConfirmed
              ? 'bg-status-confirmed/20 text-status-confirmed border border-status-confirmed cursor-default'
              : 'gradient-hero text-primary-foreground border-0'
          )}
        >
          {isConfirmed ? (
            <><CheckCircle2 className="w-3.5 h-3.5" />已确认定稿</>
          ) : (
            <><CheckCircle2 className="w-3.5 h-3.5" />标记已确认</>
          )}
        </Button>
      </div>
    </div>
  );
}
