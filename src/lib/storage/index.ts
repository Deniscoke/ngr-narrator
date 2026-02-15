// ============================================================
// Storage barrel — re-exports active repository implementation
// ============================================================

export { campaignRepo, sessionRepo, characterRepo, memoryRepo, narrationRepo, campaignStateRepo } from "./local-storage";
export type { Repository } from "./repository";
