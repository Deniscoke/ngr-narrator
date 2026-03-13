export {
  getMyCampaigns,
  createCampaign,
  joinCampaign,
  getCampaignById,
  type CampaignWithRole,
  type CampaignMemberRole,
} from "./supabase-campaigns";

export function hasSupabase(): boolean {
  if (typeof window === "undefined") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return !!(url && key);
}
