"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AssetsData } from "@/types/picturebook";
import { cn } from "@/lib/utils";

interface AssetSelectorProps {
  assets: AssetsData;
  existingRefs: string[];
  position: { top: number; left: number };
  onSelect: (assetName: string) => void;
  onClose: () => void;
}

export default function AssetSelector({
  assets,
  existingRefs,
  position,
  onSelect,
  onClose,
}: AssetSelectorProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allAssets = [
    ...assets.characters
      .filter(a => a.officialImageUrl)
      .map(a => ({ ...a, assetType: 'character' as const })),
    ...assets.scenes
      .filter(a => a.officialImageUrl)
      .map(a => ({ ...a, assetType: 'scene' as const })),
  ];

  const filteredAssets = allAssets.filter(a =>
    a.name.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredAssets.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filteredAssets[selectedIndex]) {
        e.preventDefault();
        onSelect(filteredAssets[selectedIndex].name);
      }
    },
    [filteredAssets, selectedIndex, onSelect]
  );

  if (allAssets.length === 0) {
    return (
      <div
        ref={popoverRef}
        className="fixed z-50 rounded-lg border border-border bg-popover p-3 shadow-lg text-xs text-muted-foreground font-body"
        style={{ top: position.top, left: position.left }}
      >
        暂无可引用的素材（需要先在素材设定中确认正式图）
      </div>
    );
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-64 max-h-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-2 border-b border-border">
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={e => { setFilter(e.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="搜索素材…"
          className="w-full text-xs font-body bg-transparent border-none outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="overflow-y-auto max-h-56 p-1">
        {filteredAssets.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground font-body text-center">
            未找到匹配素材
          </div>
        ) : (
          filteredAssets.map((asset, i) => {
            const isReferenced = existingRefs.includes(asset.name);
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => onSelect(asset.name)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs font-body transition-colors",
                  i === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-foreground"
                )}
              >
                <img
                  src={asset.officialImageUrl!}
                  alt={asset.name}
                  className="w-8 h-8 rounded object-cover flex-shrink-0 border border-border"
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{asset.name}</div>
                  <div className={cn(
                    "text-[10px]",
                    asset.assetType === 'character'
                      ? "text-blue-500"
                      : "text-green-500"
                  )}>
                    {asset.assetType === 'character' ? '角色' : '场景'}
                  </div>
                </div>
                {isReferenced && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">已引用</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
