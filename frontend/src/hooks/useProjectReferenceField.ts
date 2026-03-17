// hooks/useProjectReferenceField.ts
import { useCallback } from "react";
import { useReferenceField } from "@/hooks/useReferenceField";
import { ProjectsService } from "@/api/services/ProjectsService";
import type { Project_Input as Project } from "@/api/models/Project_Input";

interface UseProjectReferenceOptions {
  skip?: number;
  limit?: number;
  filters?: Record<string, unknown>;
  refreshKey?: number;
}

export function useProjectReferenceField(options?: UseProjectReferenceOptions) {
  const { skip = 0, limit = 100, filters, refreshKey = 0 } = options ?? {};
  const filtersKey = JSON.stringify(filters ?? {});

  const fetchProjects = useCallback(() => {
    return ProjectsService.listItemsProjectsGet(
      skip,
      limit,
      filtersKey !== "{}" ? filtersKey : undefined
    );
  }, [skip, limit, filtersKey]);

  const getProjectId = useCallback((p: Project) => String(p._id), []);
  const getProjectLabel = useCallback(
    (p: Project) => p.name || p.code || String(p._id),
    []
  );

  return useReferenceField(fetchProjects, getProjectId, getProjectLabel, refreshKey);
}
