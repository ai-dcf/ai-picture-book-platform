"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AssetItem } from "@/types/picturebook";
import { cn } from "@/lib/utils";

interface PromptRefPickerProps {
  characters: AssetItem[];
  scenes: AssetItem[];
  characterRefs: string[];
  sceneRefs: string[];
  onSelect: (asset: AssetItem, assetType: "character" | "scene") => void;
  onClose: () => void;
}

type PickerItem = {
  asset: AssetItem | null;
  assetType: "character" | "scene";
  displayName: string;
  imageUrl: string | null;
};

function buildItems(
  names: string[],
  assets: AssetItem[],
  assetType: "character" | "scene"
): PickerItem[] {
  return names.map((name) => {
    const asset = assets.find((item) => item.name === name) || null;
    return {
      asset,
      assetType,
      displayName: name,
      imageUrl: asset?.officialImageUrl || asset?.baseImageUrl || null,
    };
  });
}

function Section({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: PickerItem[];
  onSelect: (asset: AssetItem, assetType: "character" | "scene") => void;
}) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-[11px] font-body font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const disabled = !item.asset || !item.imageUrl;
          return (
            <button
              key={`${item.assetType}-${item.displayName}`}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (item.asset) {
                  onSelect(item.asset, item.assetType);
                }
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors",
                disabled
                  ? "cursor-not-allowed border-border/60 bg-muted/40 opacity-50"
                  : "border-border bg-card hover:bg-accent/40"
              )}
            >
              <div className="h-10 w-10 overflow-hidden rounded-md border border-border bg-muted flex-shrink-0">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    无图
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-body font-medium text-foreground">
                  {item.displayName}
                </div>
                <div className="text-[10px] font-body text-muted-foreground">
                  {disabled ? "暂无可用图片" : "点击插入引用"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PromptRefPicker({
  characters,
  scenes,
  characterRefs,
  sceneRefs,
  onSelect,
  onClose,
}: PromptRefPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  const characterItems = useMemo(
    () => buildItems(characterRefs, characters, "character"),
    [characterRefs, characters]
  );
  const sceneItems = useMemo(
    () => buildItems(sceneRefs, scenes, "scene"),
    [sceneRefs, scenes]
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-3 shadow-xl"
    >
      <div className="mb-3 text-xs font-body text-muted-foreground">
        输入 <span className="font-medium text-foreground">#</span> 后，选择角色或场景插入图片引用
      </div>
      <div className="space-y-4">
        <Section title="角色" items={characterItems} onSelect={onSelect} />
        <Section title="场景" items={sceneItems} onSelect={onSelect} />
      </div>
    </div>
  );
}
