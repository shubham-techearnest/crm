export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  pagination?: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
  errors?: Array<{ field: string; code: string; message: string }>;
  /** Machine-readable error code on failures, e.g. `DEAL_CLOSE_DATE_LOCKED`. */
  code?: string;
}
