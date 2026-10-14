// In-memory cache of tracing images (planId -> data URL) for the current browser session.
// Used when Firebase Storage upload isn't available, so the builder can still trace right after upload.
export const localImages = new Map<string, string>();

/** Load a plan's tracing image as a data URL (local cache first, then Storage URL). */
export async function loadPlanImage(planId: string, url?: string): Promise<string | undefined> {
  const cached = localImages.get(planId);
  if (cached) return cached;
  if (!url) return undefined;
  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    localImages.set(planId, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}
