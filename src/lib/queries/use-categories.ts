import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export interface CategoryData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  isDefault: boolean;
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async (): Promise<CategoryData[]> => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      // API가 items 래핑을 할 수도 있고 배열 직접 반환할 수도 있으므로 양쪽 대응
      const items = Array.isArray(data) ? data : (data.items ?? []);
      return items.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        description: (c.description as string) ?? null,
        icon: (c.icon as string) ?? null,
        displayOrder: (c.display_order as number) ?? 0,
        isDefault: (c.is_default as boolean) ?? false,
      }));
    },
  });
}
