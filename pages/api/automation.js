const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getCurrentSeason() {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return "SPRING";
  if (month >= 6 && month <= 8) return "SUMMER";
  if (month >= 9 && month <= 11) return "FALL";
  return "WINTER";
}

async function fetchAniList(query, variables = {}) {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AniList responded with ${response.status}: ${errorBody}`);
  }

  const { data } = await response.json();
  return data;
}

function buildAutomationPlan(mediaList, options) {
  const { episodesPerDay, focus, includeCompleted } = options;
  const days = DAY_ORDER.map((day) => ({
    day,
    slots: [],
    quota: episodesPerDay
  }));

  const sortedMedia = mediaList
    .map((item) => ({
      ...item,
      score: item.averageScore ?? 0,
      popularity: item.popularity ?? 0
    }))
    .sort((a, b) => {
      if (focus === "popularity") {
        return b.popularity - a.popularity;
      }
      return b.score - a.score;
    });

  const plan = [];

  sortedMedia.forEach((media) => {
    const totalEpisodes = media.episodes ?? media.nextAiringEpisode?.episode ?? 12;
    if (!includeCompleted && media.status === "FINISHED") {
      return;
    }

    for (const day of days) {
      if (day.quota <= 0) continue;

      day.slots.push({
        title: media.title?.english || media.title?.romaji || "Untitled",
        mediaId: media.id,
        episodes: Math.min(day.quota, Math.ceil(totalEpisodes / 7)),
        cover: media.coverImage?.medium,
        genres: media.genres,
        averageScore: media.averageScore,
        status: media.status
      });

      day.quota -= Math.min(day.quota, Math.ceil(totalEpisodes / 7));
      break;
    }
  });

  days.forEach((day) => {
    if (day.slots.length > 0) {
      plan.push({
        day: day.day,
        entries: day.slots
      });
    }
  });

  return plan;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const {
      preferredGenres = [],
      episodesPerDay = 2,
      focus = "score",
      includeCompleted = false
    } = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};

    const variables = {
      season: getCurrentSeason(),
      seasonYear: new Date().getUTCFullYear(),
      genres: preferredGenres.length ? preferredGenres : null
    };

    const data = await fetchAniList(
      `
        query AutomatedPlan($season: MediaSeason!, $seasonYear: Int!, $genres: [String]) {
          Page(perPage: 40) {
            media(
              type: ANIME,
              season: $season,
              seasonYear: $seasonYear,
              sort: [POPULARITY_DESC, SCORE_DESC],
              genre_in: $genres,
              status_not_in: [CANCELLED, HIATUS],
              format_not: MUSIC
            ) {
              id
              status
              title {
                romaji
                english
              }
              coverImage {
                medium
                color
              }
              episodes
              averageScore
              popularity
              genres
              nextAiringEpisode {
                airingAt
                episode
              }
            }
          }
        }
      `,
      variables
    );

    const mediaList = data?.Page?.media ?? [];
    const plan = buildAutomationPlan(mediaList, { episodesPerDay, focus, includeCompleted });

    res.status(200).json({
      generatedAt: Date.now(),
      plan,
      sourceTotal: mediaList.length,
      filters: {
        preferredGenres,
        episodesPerDay,
        focus,
        includeCompleted
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
