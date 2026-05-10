"use client";

import { useContext } from 'react';
import { StudioContext } from '@/modules/studio/presentation/context/StudioContext';

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}
