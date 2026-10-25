export type TeamSeason = {
  id: string;
  name: string;
  conference: string;
  eligible: boolean | null;
  reportedRecord?: string;
  reportedConferenceRecord?: string;
};
export type GameRevision = {
  id: string;
  season: number;
  date: string;
  state: "pre" | "in" | "post";
  completed: boolean;
  teams: [string, string];
  scores: [number | null, number | null];
  winner: string | null;
  conferenceGame: boolean;
  period: number | null;
  clock: number | null;
  observedAt: string;
  source: string;
};
export type Edition = {
  id: "ap" | "coaches" | "cfp";
  date: string;
  season: number;
  ranks: {
    id: string;
    rank: number;
    previous: number | null;
    record: string;
  }[];
};
export type Inputs = {
  pendingGames?: {
    id: string;
    name: string;
    date: string;
    knownTeamIds: string[];
    observedAt: string;
    source: string;
  }[];
  season: number;
  observedAt: string;
  teams: TeamSeason[];
  games: GameRevision[];
  editions: Edition[];
  coverage: {
    complete: boolean;
    futureComplete?: boolean;
    issues: string[];
  };
  rulesVersion: "cfp-2026-unverified-conference-adapters";
};
export type RecordRow = {
  overall: string;
  conference: string;
  wins: number;
  losses: number;
  ties: number;
  games: number;
  gameIds: string[];
  status: "reconciled" | "derived" | "conflict";
  reported?: string;
};
export type Weights = {
  id: string;
  W: number;
  R: number;
  S: number;
  P: number;
};
export type ModelRow = {
  id: string;
  name: string;
  position: number;
  score: number;
  components: {
    W: number;
    R: number;
    S: number | null;
    P: number;
  };
  record: string;
  conferenceRecord: string;
  remainingDifficulty: number | null;
  quality: {
    gameId: string;
    opponent: string;
    outcome: string;
    q: number | null;
    contribution: number;
  }[];
  modelTie: boolean;
};
export type Snapshot = {
  schema: 1;
  modelVersion: "resume-shadow-v1.1.0";
  rulesVersion: Inputs["rulesVersion"];
  shadow: true;
  mode: "confirmed" | "provisional";
  at: string;
  id: string;
  inputHash: string;
  weights: Weights;
  parentId: string | null;
  anchorIds: string[];
  assumptions: {
    gameId: string;
    winner: string;
  }[];
  rows: ModelRow[];
  issues: string[];
  field: {
    definitive: false;
    reasons: string[];
  };
  inputs: Inputs;
};
