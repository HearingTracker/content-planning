export const SEO_SYNC_TRIGGER_EMAIL = "abram@hearingtracker.com";

export function canTriggerSeoSyncForEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === SEO_SYNC_TRIGGER_EMAIL;
}
