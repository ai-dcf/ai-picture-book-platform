"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProjectHistoryEntry } from "./types";

export function useProjectHistory() {
  const [projects, setProjects] = useState<ProjectHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Failed to load projects from API:", error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveProject = useCallback(async (project: ProjectHistoryEntry) => {
    setProjects((prev) => {
      const existingIndex = prev.findIndex(
        (p) => p.projectId === project.projectId
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = project;
        return updated;
      } else {
        return [project, ...prev];
      }
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
            return updated;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("Failed to save project to API:", error);
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.projectId !== projectId));

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
