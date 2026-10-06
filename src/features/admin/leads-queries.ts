import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { deleteLead, listLeads } from "@/server/functions/leads";
import type { ListLeadsInput } from "@/server/functions/leads";

export const leadKeys = {
  list: (params: ListLeadsInput & { dateRange?: string; hasEmail?: boolean; hasPhone?: boolean }) =>
    ["admin", "leads", "list", params] as const,
  detail: (id: string) => ["admin", "leads", "detail", id] as const,
  count: ["admin", "leads", "count"] as const,
};

export function leadsListOptions(
  params: ListLeadsInput & { dateRange?: string; hasEmail?: boolean; hasPhone?: boolean },
) {
  return queryOptions({
    queryKey: leadKeys.list(params),
    queryFn: () => listLeads({ data: params }),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function leadsCountOptions() {
  return queryOptions({
    queryKey: leadKeys.count,
    queryFn: () => listLeads({ data: { page: 1, limit: 1 } }),
    staleTime: 30_000,
    select: (data) => data.total,
  });
}

export function useLeadsQuery(
  params: ListLeadsInput & { dateRange?: string; hasEmail?: boolean; hasPhone?: boolean },
) {
  return useQuery(leadsListOptions(params));
}

export function useLeadsCount() {
  return useQuery(leadsCountOptions());
}

export function useDeleteLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLead({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leads"] });
    },
  });
}
