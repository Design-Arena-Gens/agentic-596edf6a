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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const data = await fetchAniList(
      `
        query Trending($perPage: Int!) {
          Page(perPage: $perPage) {
            media(sort: TRENDING_DESC, type: ANIME, status_not: CANCELLED, format_not: MUSIC) {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
                color
              }
              description(asHtml: false)
              averageScore
              popularity
              genres
              episodes
              nextAiringEpisode {
                airingAt
                episode
                timeUntilAiring
              }
            }
          }
        }
      `,
      { perPage: 18 }
    );

    res.status(200).json({
      generatedAt: Date.now(),
      items: data?.Page?.media ?? []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
