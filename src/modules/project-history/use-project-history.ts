"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProjectHistoryEntry } from "./types";

const STORAGE_KEY = "ai-picturebook-projects";

export function useProjectHistory() {
  const [projects, setProjects] = useState<ProjectHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFromLocalStorage = useCallback((): ProjectHistoryEntry[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.error("Failed to load projects from localStorage:", error);
    }
    return [];
  }, []);

  const saveToLocalStorage = useCallback((data: ProjectHistoryEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProjects(json.data);
        saveToLocalStorage(json.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Failed to load projects from API:", error);
      const localData = loadFromLocalStorage();
      setProjects(localData);
    } finally {
      setIsLoading(false);
    }
  }, [loadFromLocalStorage, saveToLocalStorage]);

  const saveProject = useCallback(async (project: ProjectHistoryEntry) => {
    setProjects((prev) => {
      const existingIndex = prev.findIndex(
        (p) => p.projectId === project.projectId
      );
      let updated: ProjectHistoryEntry[];
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = project;
      } else {
        updated = [project, ...prev];
      }
      saveToLocalStorage(updated);
      return updated;
    });

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setProjects((prev) => {
          const existingIndex = prev.findIndex(
            (p) => p.projectId === project.projectId
          );
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = json.data;
            saveToLocalStorage(updated);
            return updated;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("Failed to save project to API:", error);
    }
  }, [saveToLocalStorage]);

  const deleteProject = useCallback(async (projectId: string) => {
    setProjects((prev) => {
      const updated = prev.filter((p) => p.projectId !== projectId);
      saveToLocalStorage(updated);
      return updated;
    });

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      console.error("Failed to delete project from API:", error);
    }
  }, [saveToLocalStorage]);

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
