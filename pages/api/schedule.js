const DAY_SECONDS = 86400;

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

function groupByDay(schedules) {
  return schedules.reduce((acc, item) => {
    const date = new Date(item.airingAt * 1000);
    const key = date.toISOString().slice(0, 10);

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push({
      mediaId: item.mediaId,
      episode: item.episode,
      airingAt: item.airingAt,
      timeUntilAiring: item.timeUntilAiring,
      media: item.media
    });

    return acc;
  }, {});
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const sevenDaysLater = now + DAY_SECONDS * 7;

  try {
    const data = await fetchAniList(
      `
        query Airing($now: Int!, $next: Int!) {
          Page(perPage: 50) {
            airingSchedules(airingAt_greater: $now, airingAt_lesser: $next, sort: TIME) {
              id
              mediaId
              episode
              airingAt
              timeUntilAiring
              media {
                title {
                  romaji
                  english
                }
                coverImage {
                  medium
                  color
                }
                episodes
                genres
                averageScore
              }
            }
          }
        }
      `,
      { now, next: sevenDaysLater }
    );

    const schedules = data?.Page?.airingSchedules ?? [];
    const grouped = groupByDay(schedules);

    res.status(200).json({
      generatedAt: Date.now(),
      grouped,
      total: schedules.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
