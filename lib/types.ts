// ============================================================
// Types — disesuaikan untuk Supabase (UUID sebagai id)
// Semua id yang tadinya number kini string (UUID)
// ============================================================

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  couple_code: string | null;
  partner_id: string | null;
  status: "single" | "linked";
  is_admin: boolean;
  wallet_balance: number;
  created_at: string;
  avatar_url: string | null;
};

export type WishlistCategory = "virtual" | "offline" | "dream" | "gift" | "other";

export type Wishlist = {
  id: number;
  couple_id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: WishlistCategory;
  is_done: boolean;
  done_by: string | null;
  done_at: string | null;
  done_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CapsuleStatus = "locked" | "delivered" | "opened";

export type Capsule = {
  id: number;
  sender_id: string;
  receiver_id: string;
  couple_id: string;
  message: string;
  opens_at: string;
  status: CapsuleStatus;
  delivered_at: string | null;
  opened_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CoinPackage = {
  id: number;           // BIGSERIAL, tetap number
  name: string;
  coin_amount: number;
  price: number;
  is_active: boolean;
};

export type CoinTransaction = {
  id: number;           // BIGSERIAL
  type: "topup" | "deduct";
  amount: number;
  payment_status: "pending" | "paid" | "failed";
  payment_reference: string | null;
  coin_package: CoinPackage | null;
  metadata: Record<string, unknown> | null;
  paid_at: string | null;
  created_at: string;
};

export type Anniversary = {
  id: number;           // BIGSERIAL
  user_id: string;      // UUID
  title: string;
  date: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WalletData = {
  user_id: string;      // UUID
  balance: number;
  updated_at: string;
};

export type Voucher = {
  id: number;
  code: string;
  coin_value: number;
  max_uses: number;
  uses_remaining: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  redemption_count?: number;
};

export type TodQuestion = {
  order: number;
  type: "truth" | "dare";
  question: string | null;
  category: string;
  source: "admin" | "user" | "ai";
  answered_by: string | null;   // UUID user yang menjawab
  is_completed: boolean;
};

export type TodCustomQuestion = {
  id: number;
  couple_id: string;    // UUID
  type: "truth" | "dare";
  category: string;
  question: string;
  source: "user" | "ai";
  is_active: boolean;   // false = pending approval (user), true = active (ai)
  created_by: string | null;
  created_at: string;
};

export type TodSession = {
  id: number;           // BIGSERIAL
  session_code: string;
  game_type: "tod" | "snake_ladder" | "quiz";
  status: "waiting" | "playing" | "completed" | "expired" | "cancelled";
  couple_id: string;        // UUID
  host_user_id: string;     // UUID
  partner_user_id: string | null;  // UUID
  coin_deducted: number;
  questions: TodQuestion[];
  partner_joined_at: string | null;
  expires_at: string | null;
  created_at: string;
};

// ── Snake & Ladder ───────────────────────────────────────────────────────────

export type SnakeCell = { from: number; to: number };
export type LadderCell = { from: number; to: number };
export type ChallengeCell = {
  square: number;
  type: "truth" | "dare";
  question: string;
  category: string;
};

export type SnakeBoardConfig = {
  snakes: SnakeCell[];
  ladders: LadderCell[];
  challenges: ChallengeCell[];
};

export type PendingChallenge = {
  player: "host" | "partner";      // siapa yang kena tantangan
  square: number;
  type: "truth" | "dare";
  question: string;
  category: string;
  roll_again: boolean;             // apakah sebelumnya dapat angka 6
};

export type LastRoll = {
  player: "host" | "partner";
  dice: number;
  from: number;                    // posisi sebelum dadu
  landed: number;                  // posisi setelah dadu (sebelum snake/ladder)
  final: number;                   // posisi akhir setelah snake/ladder
  snake_from: number | null;       // jika kena ular, dari mana
  ladder_from: number | null;      // jika naik tangga, dari mana
  bounced: boolean;                // overshoot 100 lalu balik
};

export type SnakeGameState = {
  host_position: number;
  partner_position: number;
  current_turn: "host" | "partner";
  pending_challenge: PendingChallenge | null;
  last_roll: LastRoll | null;
  winner: "host" | "partner" | null;
};

/**
 * SnakeSession = baris dari game_sessions dengan game_type='snake_ladder'
 * Kolom board_config + game_state ditambahkan di migration 006.
 */
export type SnakeSession = {
  id: number;
  session_code: string;
  game_type: "snake_ladder";
  couple_id: string;
  host_user_id: string;
  partner_user_id: string | null;
  status: "waiting" | "playing" | "completed" | "expired" | "cancelled";
  questions: [];                   // tidak dipakai untuk snake, selalu []
  board_config: SnakeBoardConfig;
  game_state: SnakeGameState;
  coin_deducted: number;
  partner_joined_at: string | null;
  expires_at: string | null;
  coin_refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Dare Derby ───────────────────────────────────────────────────────────────

export type DareDerbyDareLevel = "sweet_only" | "mixed" | "full_chaos";
export type DareDerbyPhase = "lobby" | "playing" | "result" | "game_over";
export type DareDerbyDareStatus = "pending" | "awaiting_confirm" | "completed" | "skipped";

export type DareDerbyBoardConfig = {
  total_rounds: number;
  dare_level: DareDerbyDareLevel;
  custom_dares: string[];
  minigame_sequence: string[];
};

export type DareDerbyRoundResult = {
  round_number: number;
  minigame_id: string;
  host_score: number;
  partner_score: number;
  loser: "host" | "partner" | "draw";
  dare_id: number | null;
  dare_content: string | null;
  dare_category: "sweet" | "funny" | "bold" | "challenge" | null;
  dare_status: DareDerbyDareStatus | null;
  confirmed_at: string | null;
};

export type DareDerbyRoundSubmission = {
  score: number;
  time_taken: number;
  submitted_at: string;
  metadata: Record<string, unknown>;
};

export type DareDerbyGameState = {
  phase: DareDerbyPhase;
  current_round: number;
  ready: { host: boolean; partner: boolean };
  round_submissions: {
    host: DareDerbyRoundSubmission | null;
    partner: DareDerbyRoundSubmission | null;
  };
  skip_counts: { host: number; partner: number };
  dare_counts: { host: number; partner: number };
  is_replay_round: boolean;
  pending_bonus_for: "host" | "partner" | null;
  last_round_result: DareDerbyRoundResult | null;
  forfeit_by?: "host" | "partner";
};

export type DareDerbySession = {
  id: number;
  session_code: string;
  game_type: "dare_derby";
  couple_id: string;
  host_user_id: string;
  partner_user_id: string | null;
  status: "waiting" | "playing" | "completed" | "expired" | "cancelled";
  questions: DareDerbyRoundResult[];
  board_config: DareDerbyBoardConfig;
  game_state: DareDerbyGameState;
  coin_deducted: number;
  partner_joined_at: string | null;
  expires_at: string | null;
  coin_refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Quoridor ─────────────────────────────────────────────────────────────────

export type QuoridorWall = {
  orientation: "H" | "V"; // Horizontal atau Vertical
  r: number;              // baris origin wall (0–7)
  c: number;              // kolom origin wall (0–7)
};

export type QuoridorLastAction = {
  player:  "host" | "partner";
  type:    "move" | "wall";
  payload: { r?: number; c?: number; orientation?: string };
};

export type QuoridorGameState = {
  host_pos:     { r: number; c: number }; // posisi pion host
  partner_pos:  { r: number; c: number }; // posisi pion partner
  walls:        QuoridorWall[];           // semua tembok terpasang
  walls_left:   { host: number; partner: number }; // sisa tembok (max 10 tiap)
  current_turn: "host" | "partner";
  winner:       "host" | "partner" | null;
  last_action:  QuoridorLastAction | null;
};

/**
 * QuoridorSession = baris dari game_sessions dengan game_type='quoridor'
 * host menang dengan mencapai baris 8, partner menang dengan mencapai baris 0
 */
export type QuoridorSession = {
  id:                number;
  session_code:      string;
  game_type:         "quoridor";
  couple_id:         string;
  host_user_id:      string;
  partner_user_id:   string | null;
  status:            "waiting" | "playing" | "completed" | "expired" | "cancelled";
  questions:         [];                     // tidak dipakai, selalu []
  board_config:      Record<string, never>;  // Quoridor tidak butuh board_config
  game_state:        QuoridorGameState;
  coin_deducted:     number;
  partner_joined_at: string | null;
  expires_at:        string | null;
  coin_refunded_at:  string | null;
  created_at:        string;
  updated_at:        string;
};

// Response format standar dari API Routes
export type ApiResponse<T = null> = {
  success: boolean;
  message: string;
  data: T;
};
