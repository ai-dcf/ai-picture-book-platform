"use client";
import { useRef, useCallback, CSSProperties } from 'react';
import { useStudio } from '@/modules/studio/presentation/hooks/use-studio';
import { TextBoxLayout } from '@/types/picturebook';
import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';

interface Props {
  pageIndex: number;
}

type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: { dir: HandleDir; cursor: string; posStyle: CSSProperties }[] = [
  { dir: 'nw', cursor: 'nwse-resize', posStyle: { top: -5, left: -5 } },
  { dir: 'n',  cursor: 'ns-resize',   posStyle: { top: -5, left: '50%', transform: 'translateX(-50%)' } },
  { dir: 'ne', cursor: 'nesw-resize', posStyle: { top: -5, right: -5 } },
  { dir: 'e',  cursor: 'ew-resize',   posStyle: { top: '50%', right: -5, transform: 'translateY(-50%)' } },
  { dir: 'se', cursor: 'nwse-resize', posStyle: { bottom: -5, right: -5 } },
  { dir: 's',  cursor: 'ns-resize',   posStyle: { bottom: -5, left: '50%', transform: 'translateX(-50%)' } },
  { dir: 'sw', cursor: 'nesw-resize', posStyle: { bottom: -5, left: -5 } },
  { dir: 'w',  cursor: 'ew-resize',   posStyle: { top: '50%', left: -5, transform: 'translateY(-50%)' } },
];

export default function EditorCanvas({ pageIndex }: Props) {
  const { state, dispatch, triggerSave } = useStudio();
  const page = state.pages[pageIndex];
  const editor = state.editorStates[pageIndex];
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startLayout: TextBoxLayout; mode: 'move' | HandleDir } | null>(null);

  const updateLayout = useCallback((patch: Partial<TextBoxLayout>) => {
    dispatch({ type: 'UPDATE_EDITOR_LAYOUT', payload: { pageIndex, layout: patch } });
    triggerSave();
  }, [dispatch, pageIndex, triggerSave]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const onMouseDown = useCallback((e: React.MouseEvent, mode: 'move' | HandleDir) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLayout: { ...editor.layout },
      mode,
    };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - dragRef.current.startX) / rect.width) * 100;
      const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100;
      const { startLayout, mode: m } = dragRef.current;

      let { x, y, w, h } = startLayout;

      if (m === 'move') {
        x = clamp(startLayout.x + dx, 0, 100 - w);
        y = clamp(startLayout.y + dy, 0, 100 - h);
      } else {
        // Resize handles
        if (m.includes('e')) w = clamp(startLayout.w + dx, 10, 100 - x);
        if (m.includes('s')) h = clamp(startLayout.h + dy, 5, 100 - y);
        if (m.includes('w')) {
          const newX = clamp(startLayout.x + dx, 0, startLayout.x + startLayout.w - 10);
          w = startLayout.w + (startLayout.x - newX);
          x = newX;
        }
        if (m.includes('n')) {
          const newY = clamp(startLayout.y + dy, 0, startLayout.y + startLayout.h - 5);
          h = startLayout.h + (startLayout.y - newY);
          y = newY;
        }
      }

      dispatch({ type: 'UPDATE_EDITOR_LAYOUT', payload: { pageIndex, layout: { x, y, w, h } } });
    }

    function onUp() {
      dragRef.current = null;
      triggerSave();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [editor.layout, dispatch, pageIndex, triggerSave]);

  const { layout, style, textContent } = editor;

  const textStyle: CSSProperties = {
    fontSize: `${style.fontSize}px`,
    fontWeight: style.fontWeight === 'bold' ? 700 : 400,
    color: style.textColor,
    textAlign: style.textAlign,
    fontFamily: "'Noto Serif SC', serif",
    lineHeight: 1.6,
    wordBreak: 'break-all' as const,
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full aspect-square rounded-xl overflow-hidden bg-muted select-none border border-border shadow-card"
      style={{ userSelect: 'none' }}
    >
      {/* Background image */}
      {page?.imageUrl ? (
        <img
          src={page.imageUrl}
          alt="插画背景"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="text-center">
            <ImageIcon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-1" />
            <p className="text-xs font-body text-muted-foreground/60">暂无插画</p>
          </div>
        </div>
      )}

      {/* Draggable text box */}
      <div
        className="absolute"
        style={{
          left: `${layout.x}%`,
          top: `${layout.y}%`,
          width: `${layout.w}%`,
          height: `${layout.h}%`,
        }}
      >
        {/* Text box content */}
        <div
          onMouseDown={e => onMouseDown(e, 'move')}
          className="w-full h-full rounded-lg bg-card/80 backdrop-blur-sm border-2 border-primary/50 cursor-move overflow-hidden flex items-center justify-center p-2 shadow-elevated"
          style={{ cursor: 'move' }}
        >
          <p style={textStyle} className="w-full">
            {textContent || <span style={{ color: 'inherit', opacity: 0.4 }}>在右侧输入文字…</span>}
          </p>
        </div>

        {/* Resize handles */}
        {HANDLES.map(h => (
          <div
            key={h.dir}
            onMouseDown={e => onMouseDown(e, h.dir)}
            className="absolute w-2.5 h-2.5 rounded-full bg-primary border-2 border-primary-foreground shadow-sm z-10"
            style={{ ...h.posStyle, cursor: h.cursor }}
          />
        ))}
      </div>
    </div>
  );
}
