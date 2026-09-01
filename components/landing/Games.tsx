import { createClient } from "@/lib/supabase/server";
import { GamesCarousel, GameItem } from "./GamesCarousel";

interface GameSetting {
  id: number;
  game_type: string;
  display_name: string;
  description: string | null;
  coin_cost: number;
  is_active: boolean;
}

const GAME_FALLBACK_INFO: Record<
  string,
  {
    href: string;
    iconType: GameItem["iconType"];
    title: string;
    desc: string;
  }
> = {
  tod: {
    href: "/dashboard/games/tod",
    iconType: "tod",
    title: "Truth or Dare",
    desc: "Ratusan pertanyaan mendalam dan tantangan seru yang dirancang khusus untuk mempererat keintiman emosional kalian berdua.",
  },
  snake_ladder: {
    href: "/dashboard/games/snake-ladder",
    iconType: "snake_ladder",
    title: "Snake & Ladder Date",
    desc: "Ular tangga klasik yang dirombak penuh tantangan romantis di setiap petaknya. Bermain secara real-time sambil bertatap muka via audio.",
  },
  dare_derby: {
    href: "/dashboard/games/dare-derby",
    iconType: "dare_derby",
    title: "Dare Derby",
    desc: "Turnamen tantangan mini yang adil dan lucu. Siapa yang kalah harus melakukan hukuman menggemaskan di video call selanjutnya!",
  },
  quoridor: {
    href: "/dashboard/games/quoridor",
    iconType: "quoridor",
    title: "Quoridor",
    desc: "Game strategi papan 9×9. Gerakkan pion atau pasang tembok — yang pertama mencapai garis lawan menang!",
  },
};

const DEFAULT_GAMES: Array<{
  game_type: string;
  display_name: string;
  description: string;
  coin_cost: number;
}> = [
  {
    game_type: "tod",
    display_name: "Truth or Dare",
    description: "Ratusan pertanyaan mendalam dan tantangan seru yang dirancang khusus untuk mempererat keintiman emosional kalian berdua.",
    coin_cost: 1,
  },
  {
    game_type: "snake_ladder",
    display_name: "Snake & Ladder Date",
    description: "Ular tangga klasik yang dirombak penuh tantangan romantis di setiap petaknya. Bermain secara real-time sambil bertatap muka via audio.",
    coin_cost: 5,
  },
  {
    game_type: "dare_derby",
    display_name: "Dare Derby",
    description: "Turnamen tantangan mini yang adil dan lucu. Siapa yang kalah harus melakukan hukuman menggemaskan di video call selanjutnya!",
    coin_cost: 3,
  },
  {
    game_type: "quoridor",
    display_name: "Quoridor",
    description: "Game strategi papan 9×9. Gerakkan pion atau pasang tembok — yang pertama mencapai garis lawan menang!",
    coin_cost: 3,
  },
];

export async function Games() {
  let gamesList: GameItem[] = [];

  try {
    const supabase = await createClient();
    const { data: dbSettings } = await supabase
      .from("game_settings")
      .select("id, game_type, display_name, description, coin_cost, is_active")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (dbSettings && dbSettings.length > 0) {
      gamesList = dbSettings.map((item: GameSetting) => {
        const info = GAME_FALLBACK_INFO[item.game_type];
        return {
          id: item.game_type,
          title: item.display_name || info?.title || item.game_type,
          desc: item.description || info?.desc || "",
          price: `${item.coin_cost} Coin / Sesi`,
          href: info?.href || `/dashboard/games/${item.game_type}`,
          iconType: info?.iconType || "default",
        };
      });
    }
  } catch {
    // Gunakan fallback jika DB error
  }

  if (gamesList.length === 0) {
    gamesList = DEFAULT_GAMES.map((item) => {
      const info = GAME_FALLBACK_INFO[item.game_type];
      return {
        id: item.game_type,
        title: item.display_name,
        desc: item.description,
        price: `${item.coin_cost} Coin / Sesi`,
        href: info?.href || `/dashboard/games/${item.game_type}`,
        iconType: info?.iconType || "default",
      };
    });
  }

  return (
    <section className="bg-[#FCFBF7] py-20 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-6 text-center">
        {/* Subtitle tag */}
        <span className="text-[10px] font-semibold tracking-wider text-[#C84B31] uppercase">
          Satu Platform, Banyak Cara Dekat
        </span>

        {/* Section Title */}
        <h2 className="font-editorial mt-3 text-3xl font-normal leading-tight text-[#1F1D1B] sm:text-4xl">
          Pilihan game romantis untuk malam <br />
          kencan digital kalian.
        </h2>

        {/* Games Carousel Component */}
        <GamesCarousel games={gamesList} />
      </div>
    </section>
  );
}
