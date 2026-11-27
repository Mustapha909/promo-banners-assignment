import type { Banner, BannerStatus } from "../types/banners";

export function getBannerStatus(banner: Banner, now: Date): BannerStatus {
  if (!banner.enabled) return "disabled";

  const startsAt = Date.parse(banner.startsAt);
  const endsAt = Date.parse(banner.endsAt);

  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return "expired";
  if (now.getTime() < startsAt) return "scheduled";
  if (now.getTime() >= endsAt) return "expired";

  return "live";
}

export function getActiveBanners(banners: Banner[], now: Date): Banner[] {
  return banners
    .filter((banner) => getBannerStatus(banner, now) === "live")
    .sort((a, b) => a.priority - b.priority || b.startsAt.localeCompare(a.startsAt));
}
