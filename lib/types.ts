// ============================================================
// Types — disesuaikan untuk Supabase (UUID sebagai id)
// Semua id yang tadinya number kini string (UUID)
// ============================================================

export type AuthUser = {
  id: string;           // UUID dari auth.users
  name: string;
  email: string;
  couple_code: string | null;
  partner_id: string | null;  // UUID
  status: "single" | "linked";
  is_admin: boolean;
  wallet_balance: number;
  created_at: string;
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

// Response format standar dari API Routes
export type ApiResponse<T = null> = {
  success: boolean;
  message: string;
  data: T;
};
