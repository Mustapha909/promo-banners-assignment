import type { APIRoute } from "astro";
import { reportAndFlush } from "../../../../lib/report-error";
import { getBanners } from "../../../../store/bannersClient";
import { jsonError, jsonResponse } from "../../../../utils/apiResponse";
import { isAuthorized, unauthorizedResponse } from "../../../../utils/basicAuth";
import { getBannerKv } from "../../../../utils/getEnv";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  if (!isAuthorized(request, locals)) {
    return unauthorizedResponse();
  }

  const kv = getBannerKv(locals);

  if (!kv) {
    return jsonError(503, "Banner service unavailable");
  }

  try {
    const banners = await getBanners(kv);
    banners.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return jsonResponse(banners);
  } catch (error) {
    reportAndFlush(error, { context: "admin banners" }, locals);

    return jsonError(500, "Failed to fetch banners");
  }
};
