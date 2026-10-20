import { request, ApiError } from "./client.ts";

export type MaterialResourceType =
  | "reading"
  | "reference_guide"
  | "vocabulary_list"
  | "activity_sheet"
  | "audio_transcript";

export type MaterialView = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  resource_type: MaterialResourceType;
  content_text: string | null;
  reference_url: string | null;
  media_url: string | null;
  is_required: boolean;
  source_metadata: Record<string, unknown>;
};

export type MaterialPage = {
  items: MaterialView[];
  lesson_id: string;
  lesson_name: string;
  total_count: number;
  as_of: string;
};

export type NotificationEventType =
  | "assignment_published"
  | "class_announcement"
  | "learning_material_available"
  | "general";

export type NotificationItem = {
  id: string;
  event_type: NotificationEventType;
  title: string;
  message: string;
  related_resource_type: string | null;
  related_resource_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationPage = {
  items: NotificationItem[];
  limit: number;
  offset: number;
  has_more: boolean;
  unread_count: number;
  as_of: string;
};

function invalid(): never {
  throw new ApiError(0, "Unexpected response data. Refresh to retry.");
}

const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function validateMaterialPage(page: MaterialPage): MaterialPage {
  if (!page || !Array.isArray(page.items) || typeof page.lesson_id !== "string" || !date(page.as_of)) {
    invalid();
  }
  for (const item of page.items) {
    if (!item || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.is_required !== "boolean") {
      invalid();
    }
  }
  return page;
}

export function validateNotificationPage(page: NotificationPage): NotificationPage {
  if (!page || !Array.isArray(page.items) || typeof page.unread_count !== "number" || !date(page.as_of)) {
    invalid();
  }
  for (const item of page.items) {
    if (!item || typeof item.id !== "string" || typeof item.title !== "string" || !date(item.created_at)) {
      invalid();
    }
  }
  return page;
}

export const materialsApi = {
  getLessonMaterials: async (secret: string, lessonId: string): Promise<MaterialPage> => {
    return validateMaterialPage(
      await request<MaterialPage>(`/lessons/${encodeURIComponent(lessonId)}/materials`, "GET", undefined, secret)
    );
  },
};

export const notificationsApi = {
  list: async (secret: string, limit = 20, offset = 0): Promise<NotificationPage> => {
    return validateNotificationPage(
      await request<NotificationPage>(`/me/notifications?limit=${limit}&offset=${offset}`, "GET", undefined, secret)
    );
  },
  read: async (secret: string, notificationId: string): Promise<NotificationItem> => {
    return await request<NotificationItem>(
      `/me/notifications/${encodeURIComponent(notificationId)}/read`,
      "POST",
      {},
      secret
    );
  },
  readAll: async (secret: string): Promise<{ read_count: number }> => {
    return await request<{ read_count: number }>("/me/notifications/read-all", "POST", {}, secret);
  },
};

export function materialsAccess(run: <T>(operation: (secret: string) => Promise<T>) => Promise<T>) {
  return {
    getLessonMaterials: (lessonId: string) => run(s => materialsApi.getLessonMaterials(s, lessonId)),
  };
}

export function notificationsAccess(run: <T>(operation: (secret: string) => Promise<T>) => Promise<T>) {
  return {
    list: (limit = 20, offset = 0) => run(s => notificationsApi.list(s, limit, offset)),
    read: (notificationId: string) => run(s => notificationsApi.read(s, notificationId)),
    readAll: () => run(s => notificationsApi.readAll(s)),
  };
}

export type MaterialsAccess = ReturnType<typeof materialsAccess>;
export type NotificationsAccess = ReturnType<typeof notificationsAccess>;
