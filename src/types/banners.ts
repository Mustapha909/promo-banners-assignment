export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  startsAt: string; // ISO-8601 in UTC, e.g. "2026-12-01T09:00:00.000Z"
  endsAt: string; // ISO-8601 in UTC, e.g. "2026-12-01T09:00:00.000Z"
  enabled: boolean;
  priority: number; // lower number shows first.
  createdAt: string; // ISO-8601 in UTC, e.g. "2026-12-01T09:00:00.000Z"
  updatedAt: string; // ISO-8601 in UTC, e.g. "2026-12-01T09:00:00.000Z"
}

export type BannerStatus = "live" | "scheduled" | "expired" | "disabled";

export type BannerInput = Omit<Banner, "id" | "createdAt" | "updatedAt">;
