export type PuzzlePublic = {
  /** Daily puzzles use the date; pool puzzles use UUID */
  id: string;
  category: string;
  topic: string;
  sentences: string[];
  source_url: string;
  source_license: string;
  /** Obfuscated reveal payload — decode client-side after submit */
  reveal: string;
  /** Present on dated daily puzzles */
  date?: string;
};

export type ArchiveItem = {
  date: string;
  category: string;
  topic: string;
};

export type RevealPayload = {
  lie_index: number;
  truth: string;
};

export type PuzzleRow = {
  date: string;
  category: string;
  topic: string;
  sentences: string;
  lie_index: number;
  truth: string;
  source_url: string;
  source_license: string;
  status: string;
};

export type PoolPuzzleRow = {
  id: string;
  category: string;
  topic: string;
  sentences: string;
  lie_index: number;
  truth: string;
  source_url: string;
  source_license: string;
  status: string;
  created_at: string;
};

export type DailySetResponse = {
  set_id: string;
  date: string;
  mode: string;
  puzzles: PuzzlePublic[];
};

export type GameStats = {
  streak: number;
  totalCorrect: number;
  totalPlayed: number;
  lastPlayedDate: string | null;
  history: Record<
    string,
    {
      correct: boolean;
      guessIndex: number;
    }
  >;
  setsCompleted: number;
};

export type RunAnswer = {
  puzzleId: string;
  guessIndex: number;
  correct: boolean;
};

export type RunState = {
  setId: string;
  index: number;
  answers: RunAnswer[];
  completed: boolean;
  /** Whether setsCompleted counter was already incremented */
  scored?: boolean;
};
