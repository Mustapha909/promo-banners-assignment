import type { APIRoute } from "astro";
import { reportAndFlush } from "../../../lib/report-error";
import { getBanners } from "../../../store/bannersClient";
import { getActiveBanners } from "../../../utils/bannerSchedule";
import { getBannerKv } from "../../../utils/getEnv";
import { jsonError, jsonResponse } from "../../../utils/apiResponse";

export const prerender = false;

const PUBLIC_READ_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const GET: APIRoute = async ({ locals }) => {
  const kv = getBannerKv(locals);

  if (!kv) {
    return jsonError(503, "Banner service unavailable", {
      headers: PUBLIC_READ_CORS,
    });
  }

  try {
    const banners = await getBanners(kv);
    const activeBanners = getActiveBanners(banners, new Date()).map(
      ({ id, title, imageUrl, linkUrl }) => ({
        id,
        title,
        imageUrl,
        linkUrl,
      })
    );

    return jsonResponse(activeBanners, 200, PUBLIC_READ_CORS);
  } catch (error) {
    reportAndFlush(error, { context: "banners active" }, locals);

    return jsonError(500, "Failed to fetch banners", {
      headers: PUBLIC_READ_CORS,
    });
  }
};
