"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProjectHistoryEntry } from "./types";

const STORAGE_KEY = "ai-picturebook-projects";

export function useProjectHistory() {
  const [projects, setProjects] = useState<ProjectHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProjects = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProjects(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveProject = useCallback((project: ProjectHistoryEntry) => {
    setProjects((prev) => {
      const existingIndex = prev.findIndex(
        (p) => p.projectId === project.projectId
      );
      let updated;
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = project;
      } else {
        updated = [project, ...prev];
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save project:", error);
      }
      return updated;
    });
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      const updated = prev.filter((p) => p.projectId !== projectId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to delete project:", error);
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    isLoading,
    saveProject,
    deleteProject,
    loadProjects,
  };
}
