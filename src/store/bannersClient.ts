import type { Banner, BannerInput } from "../types/banners";
const BANNER_PREFIX = "banner:";

function getBannerKey(bannerId: string): string {
  return `${BANNER_PREFIX}${bannerId}`;
}

export async function getBanner(bannerKv: KVNamespace, bannerId: string): Promise<Banner | null> {
  const bannerKey = getBannerKey(bannerId);
  const value = await bannerKv.get(bannerKey);
  if (!value) {
    return null;
  }

  try {
    const banner = JSON.parse(value) as Banner;
    return banner;
  } catch {
    console.error(`Failed to parse banner with ID ${bannerId}:`);
    return null;
  }
}

export async function getBanners(bannerKv: KVNamespace): Promise<Banner[]> {
  const banners: Banner[] = [];
  let cursor: string | undefined;
  let listComplete: boolean;

  do {
    const page = await bannerKv.list({
      prefix: BANNER_PREFIX,
      ...(cursor ? { cursor } : {}),
    });

    const pageBanners = await Promise.all(
      page.keys.map(({ name }) => getBanner(bannerKv, name.slice(BANNER_PREFIX.length)))
    );

    banners.push(...pageBanners.filter((banner): banner is Banner => banner !== null));

    cursor = page.cursor;
    listComplete = page.list_complete;
  } while (!listComplete);

  return banners;
}

export async function createBanner(bannerKv: KVNamespace, input: BannerInput): Promise<Banner> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const banner: Banner = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await bannerKv.put(getBannerKey(id), JSON.stringify(banner));
  return banner;
}

export async function updateBanner(
  bannerKv: KVNamespace,
  bannerId: string,
  input: Partial<BannerInput>
): Promise<Banner | null> {
  const existingBanner = await getBanner(bannerKv, bannerId);
  if (!existingBanner) {
    return null;
  }

  const updatedBanner: Banner = {
    ...existingBanner,
    ...input,
    id: existingBanner.id,
    createdAt: existingBanner.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await bannerKv.put(getBannerKey(bannerId), JSON.stringify(updatedBanner));
  return updatedBanner;
}

export async function deleteBanner(bannerKv: KVNamespace, bannerId: string): Promise<boolean> {
  const existingBanner = await getBanner(bannerKv, bannerId);
  if (!existingBanner) {
    return false;
  }

  await bannerKv.delete(getBannerKey(bannerId));
  return true;
}
