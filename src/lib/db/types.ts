export type NarrationMode = "mock" | "ai";

export type NarrationEntry = {
    id: string;
    campaign_id: string;
    mode: NarrationMode;
    player_input: string;
    narrator_output: string;
    choices: string[];
    created_at: string;
};

export type Campaign = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
};
