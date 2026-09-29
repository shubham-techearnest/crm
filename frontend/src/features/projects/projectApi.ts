import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

function assertSuccess(response: ApiResponse<unknown>, fallback = "Request failed"): void {
  if (!response.success) {
    throw new Error(response.message ?? fallback);
  }
}

export interface Project {
  id: string;
  organizationId: string;
  regionId: string;
  accountId: string;
  dealId: string | null;
  projectManagerId: string | null;
  name: string;
  projectCode: string;
  description: string | null;
  status: string;
  priority: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  estimatedHours: number | null;
  actualHours: number | null;
  billingType: string;
  progressPercent: number | null;
  health?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectBody {
  organizationId?: string;
  regionId: string;
  accountId: string;
  dealId?: string | null;
  projectManagerId?: string | null;
  name: string;
  projectCode: string;
  description?: string;
  status?: string;
  priority?: string;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  estimatedHours?: number | null;
  billingType: string;
}

export interface UpdateProjectBody {
  regionId?: string;
  accountId?: string;
  projectManagerId?: string | null;
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  estimatedHours?: number | null;
  billingType?: string;
}

export interface CreateProjectFromDealBody {
  name?: string;
  projectCode?: string;
  projectManagerId?: string | null;
  billingType?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface Milestone {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilestoneBody {
  name: string;
  description?: string;
  dueDate?: string | null;
  status?: string;
  sortOrder?: number | null;
}

export interface UpdateMilestoneBody {
  name?: string;
  description?: string;
  dueDate?: string | null;
  status?: string;
  sortOrder?: number | null;
}

export interface ProjectTask {
  id: string;
  organizationId: string;
  projectId: string;
  milestoneId: string | null;
  parentTaskId: string | null;
  assignedResourceId: string | null;
  name: string;
  description: string | null;
  status: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  completionPercentage: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskBody {
  milestoneId?: string | null;
  parentTaskId?: string | null;
  assignedResourceId?: string | null;
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  completionPercentage?: number | null;
}

export interface UpdateTaskBody {
  milestoneId?: string | null;
  parentTaskId?: string | null;
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  completionPercentage?: number | null;
}

export interface AssignTaskBody {
  assignedResourceId: string;
}

export interface AddDependencyBody {
  predecessorTaskId: string;
  type?: string;
}

export interface TaskDependency {
  id: string;
  organizationId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface CreateCommentBody {
  body: string;
}

// —— Projects ——

export async function listProjects(params?: {
  search?: string;
  status?: string;
  accountId?: string;
  projectManagerId?: string;
  startFrom?: string;
  endTo?: string;
  delayedOnly?: boolean;
}): Promise<Project[]> {
  const { data } = await api.get<ApiResponse<Project[]>>("/projects", {
    params: {
      size: 100,
      search: params?.search || undefined,
      status: params?.status || undefined,
      accountId: params?.accountId || undefined,
      projectManagerId: params?.projectManagerId || undefined,
      startFrom: params?.startFrom || undefined,
      endTo: params?.endTo || undefined,
      delayedOnly: params?.delayedOnly || undefined,
    },
  });
  return unwrap(data);
}

export async function getProject(id: string): Promise<Project> {
  const { data } = await api.get<ApiResponse<Project>>(`/projects/${id}`);
  return unwrap(data);
}

export async function createProject(body: CreateProjectBody): Promise<Project> {
  const { data } = await api.post<ApiResponse<Project>>("/projects", body);
  return unwrap(data);
}

export async function updateProject(id: string, body: UpdateProjectBody): Promise<Project> {
  const { data } = await api.put<ApiResponse<Project>>(`/projects/${id}`, body);
  return unwrap(data);
}

export async function deleteProject(id: string): Promise<void> {
  const { data } = await api.delete<ApiResponse<null>>(`/projects/${id}`);
  assertSuccess(data, "Could not delete project");
}

export async function createProjectFromDeal(
  dealId: string,
  body?: CreateProjectFromDealBody,
): Promise<Project> {
  const { data } = await api.post<ApiResponse<Project>>(
    `/deals/${dealId}/create-project`,
    body ?? {},
  );
  return unwrap(data);
}

// —— Milestones ——

export async function listMilestones(
  projectIdOrFilters?:
    | string
    | {
        projectId?: string;
        status?: string;
        dueFrom?: string;
        dueTo?: string;
        search?: string;
      },
): Promise<Milestone[]> {
  if (typeof projectIdOrFilters === "string") {
    const { data } = await api.get<ApiResponse<Milestone[]>>(
      `/projects/${projectIdOrFilters}/milestones`,
    );
    return unwrap(data);
  }
  const params = projectIdOrFilters ?? {};
  const { data } = await api.get<ApiResponse<Milestone[]>>("/milestones", {
    params: {
      size: 100,
      projectId: params.projectId || undefined,
      status: params.status || undefined,
      dueFrom: params.dueFrom || undefined,
      dueTo: params.dueTo || undefined,
    },
  });
  return unwrap(data);
}

export async function createMilestone(
  projectId: string,
  body: CreateMilestoneBody,
): Promise<Milestone> {
  const { data } = await api.post<ApiResponse<Milestone>>(
    `/projects/${projectId}/milestones`,
    body,
  );
  return unwrap(data);
}

export async function updateMilestone(
  id: string,
  body: UpdateMilestoneBody,
): Promise<Milestone> {
  const { data } = await api.put<ApiResponse<Milestone>>(`/milestones/${id}`, body);
  return unwrap(data);
}

// —— Tasks ——

export async function listTasks(
  projectIdOrFilters?:
    | string
    | {
        projectId?: string;
        status?: string;
        assignedResourceId?: string;
        priority?: string;
        dueFrom?: string;
        dueTo?: string;
      },
): Promise<ProjectTask[]> {
  if (typeof projectIdOrFilters === "string") {
    const { data } = await api.get<ApiResponse<ProjectTask[]>>(
      `/projects/${projectIdOrFilters}/tasks`,
    );
    return unwrap(data);
  }
  const params = projectIdOrFilters ?? {};
  const { data } = await api.get<ApiResponse<ProjectTask[]>>("/tasks", {
    params: {
      size: 100,
      projectId: params.projectId || undefined,
      status: params.status || undefined,
      assignedResourceId: params.assignedResourceId || undefined,
      priority: params.priority || undefined,
      dueFrom: params.dueFrom || undefined,
      dueTo: params.dueTo || undefined,
    },
  });
  return unwrap(data);
}

export async function getTask(id: string): Promise<ProjectTask> {
  const { data } = await api.get<ApiResponse<ProjectTask>>(`/tasks/${id}`);
  return unwrap(data);
}

export async function createTask(projectId: string, body: CreateTaskBody): Promise<ProjectTask> {
  const { data } = await api.post<ApiResponse<ProjectTask>>(`/projects/${projectId}/tasks`, body);
  return unwrap(data);
}

export async function updateTask(id: string, body: UpdateTaskBody): Promise<ProjectTask> {
  const { data } = await api.put<ApiResponse<ProjectTask>>(`/tasks/${id}`, body);
  return unwrap(data);
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

export async function assignTask(id: string, body: AssignTaskBody): Promise<ProjectTask> {
  const { data } = await api.post<ApiResponse<ProjectTask>>(`/tasks/${id}/assign`, body);
  return unwrap(data);
}

export async function addDependency(
  taskId: string,
  body: AddDependencyBody,
): Promise<TaskDependency> {
  const { data } = await api.post<ApiResponse<TaskDependency>>(
    `/tasks/${taskId}/dependencies`,
    body,
  );
  return unwrap(data);
}

export async function listComments(taskId: string): Promise<TaskComment[]> {
  const { data } = await api.get<ApiResponse<TaskComment[]>>(`/tasks/${taskId}/comments`);
  return unwrap(data);
}

export async function addComment(taskId: string, body: CreateCommentBody): Promise<TaskComment> {
  const { data } = await api.post<ApiResponse<TaskComment>>(`/tasks/${taskId}/comments`, body);
  return unwrap(data);
}
