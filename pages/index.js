import Image from "next/image";
import { useMemo, useState } from "react";
import useSWR from "swr";
import classNames from "classnames";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const fetcher = (url) => fetch(url).then((res) => res.json());

const GENRES = [
  "Action",
  "Adventure",
  "Sci-Fi",
  "Fantasy",
  "Comedy",
  "Drama",
  "Slice of Life",
  "Mystery",
  "Psychological",
  "Romance",
  "Music",
  "Supernatural",
  "Sports"
];

const FOCUS_OPTIONS = [
  { label: "Balanced (Score)", value: "score" },
  { label: "Hype (Popularity)", value: "popularity" }
];

function formatTimeUntil(seconds) {
  if (seconds < 0) return "Now";
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatDate(ts) {
  const date = new Date(ts * 1000);
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function buildChartData(plan) {
  const labels = plan.map((item) => item.day.slice(0, 3));
  const totals = plan.map((item) =>
    item.entries.reduce((sum, entry) => sum + (entry.episodes || 1), 0)
  );
  return {
    labels,
    datasets: [
      {
        label: "Episodes Scheduled",
        data: totals,
        backgroundColor: "rgba(115, 158, 255, 0.6)",
        borderRadius: 12,
        borderSkipped: false
      }
    ]
  };
}

export default function Home() {
  const { data: trendingData, isLoading: trendingLoading } = useSWR("/api/trending", fetcher, {
    revalidateOnFocus: false
  });
  const { data: scheduleData, isLoading: scheduleLoading } = useSWR("/api/schedule", fetcher, {
    revalidateOnFocus: false
  });

  const [selectedGenres, setSelectedGenres] = useState(["Action", "Sci-Fi"]);
  const [episodesPerDay, setEpisodesPerDay] = useState(2);
  const [focus, setFocus] = useState("score");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [automationResult, setAutomationResult] = useState(null);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationError, setAutomationError] = useState(null);

  const trending = trendingData?.items ?? [];
  const scheduleGrouped = scheduleData?.grouped ?? {};

  const chartData = useMemo(
    () => (automationResult?.plan ? buildChartData(automationResult.plan) : null),
    [automationResult]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: { color: "#b7c6f3" },
          grid: { color: "rgba(90, 120, 190, 0.12)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#b7c6f3", precision: 0 },
          grid: { color: "rgba(90, 120, 190, 0.12)" }
        }
      }
    }),
    []
  );

  async function runAutomation() {
    setAutomationLoading(true);
    setAutomationError(null);
    try {
      const response = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredGenres: selectedGenres,
          episodesPerDay,
          focus,
          includeCompleted
        })
      });

      if (!response.ok) {
        throw new Error(`Automation failed: ${response.statusText}`);
      }

      const data = await response.json();
      setAutomationResult(data);
    } catch (error) {
      setAutomationError(error.message);
    } finally {
      setAutomationLoading(false);
    }
  }

  return (
    <div className="page">
      <main className="page-main">
        <header className="hero">
          <div className="badge">
            <span className="status-dot live" /> Automation Hub
          </div>
          <h1>Anime Automation Control Center</h1>
          <p>
            Generate a smart watch plan, track upcoming episodes, and surf the latest hype — all
            automatically curated from AniList data. No spreadsheets, no manual syncing.
          </p>
          <div className="input-group" style={{ justifyContent: "center" }}>
            <label>
              Episodes / day:{" "}
              <input
                type="number"
                min="1"
                max="6"
                value={episodesPerDay}
                onChange={(event) => setEpisodesPerDay(Number(event.target.value))}
              />
            </label>
            <label>
              Focus:
              <select value={focus} onChange={(event) => setFocus(event.target.value)}>
                {FOCUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeCompleted}
                onChange={(event) => setIncludeCompleted(event.target.checked)}
                style={{ marginRight: "0.4rem" }}
              />
              Include finished shows
            </label>
            <button className="button" onClick={runAutomation} disabled={automationLoading}>
              {automationLoading ? "Generating…" : "Run Automation"}
            </button>
          </div>
          <p className="muted">
            Genres locked in:{" "}
            {selectedGenres.length ? selectedGenres.join(", ") : "All — let the agent decide"}
          </p>
        </header>

        <section className="card">
          <h2 className="section-title">Genre Automation Filters</h2>
          <div className="input-group" style={{ flexWrap: "wrap" }}>
            {GENRES.map((genre) => {
              const active = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  className={classNames("button", { secondary: !active })}
                  onClick={() => {
                    setSelectedGenres((prev) => {
                      if (prev.includes(genre)) {
                        return prev.filter((item) => item !== genre);
                      }
                      return [...prev, genre];
                    });
                  }}
                  style={{ fontSize: "0.85rem", padding: "0.5rem 0.8rem" }}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </section>

        <div className="layout-columns" style={{ marginTop: "2rem" }}>
          <section className="card">
            <h2 className="section-title">Automation Blueprint</h2>
            {automationError && <p className="muted">⚠️ {automationError}</p>}
            {!automationResult && <p className="muted">Run the automation to generate a plan.</p>}
            {automationResult?.plan?.length ? (
              <>
                <ul className="automation-steps">
                  {automationResult.plan.map((slot) => (
                    <li key={slot.day}>
                      <span className="step-index">{slot.day.slice(0, 1)}</span>
                      <div>
                        <strong>{slot.day}</strong>
                        <div className="automation-preview">
                          {slot.entries.map((entry) => (
                            <div
                              key={entry.mediaId}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.75rem",
                                marginBottom: "0.65rem"
                              }}
                            >
                              {entry.cover && (
                                <Image
                                  src={entry.cover}
                                  alt={entry.title}
                                  width={48}
                                  height={68}
                                  style={{
                                    borderRadius: "10px",
                                    objectFit: "cover",
                                    border: "1px solid rgba(100,130,195,0.4)"
                                  }}
                                />
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span>{entry.title}</span>
                                  <span className="tag">
                                    {entry.episodes} ep{entry.episodes > 1 ? "s" : ""}
                                  </span>
                                </div>
                                <p className="muted" style={{ marginTop: "0.3rem" }}>
                                  {entry.genres?.slice(0, 3).join(" • ") || "No genre data"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {chartData && (
                  <div className="card chart-card" style={{ marginTop: "1.5rem" }}>
                    <h3 style={{ margin: 0 }}>Weekly Load</h3>
                    <p className="muted">Review how the agent scheduled episodes across your week.</p>
                    <Bar data={chartData} options={chartOptions} />
                  </div>
                )}
              </>
            ) : null}
          </section>

          <section className="card">
            <h2 className="section-title">Live Airing Monitor</h2>
            {scheduleLoading && <p className="muted">Syncing schedule…</p>}
            {!scheduleLoading && !Object.keys(scheduleGrouped).length ? (
              <p className="muted">No episodes scheduled within the next seven days.</p>
            ) : null}
            <div className="automation-preview" style={{ maxHeight: "420px" }}>
              {Object.entries(scheduleGrouped).map(([dateKey, items]) => (
                <div key={dateKey} style={{ marginBottom: "1rem" }}>
                  <strong>{new Date(dateKey).toLocaleDateString()}</strong>
                  <table className="schedule-table">
                    <tbody>
                      {items.map((episode) => (
                        <tr key={`${episode.mediaId}-${episode.episode}`}>
                          <td>
                            <span className="status-dot upcoming" />
                          </td>
                          <td>
                            {episode.media.title.english ||
                              episode.media.title.romaji ||
                              "Untitled"}
                            <div className="muted">
                              Ep {episode.episode} • {formatDate(episode.airingAt)}
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span className="tag">{formatTimeUntil(episode.timeUntilAiring)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="card" style={{ marginTop: "2rem" }}>
          <h2 className="section-title">Trending Automations</h2>
          {trendingLoading ? (
            <p className="muted">Fetching trending anime…</p>
          ) : (
            <div className="card-grid">
              {trending.map((item) => (
                <article
                  key={item.id}
                  className="card"
                  style={{
                    borderColor: item.coverImage?.color
                      ? `${item.coverImage.color}90`
                      : "rgba(123,149,209,0.45)",
                    background: "rgba(22, 30, 48, 0.85)"
                  }}
                >
                  {item.coverImage?.large && (
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        borderRadius: "12px",
                        overflow: "hidden",
                        marginBottom: "0.9rem",
                        height: "320px"
                      }}
                    >
                      <Image
                        src={item.coverImage.large}
                        alt={item.title.english || item.title.romaji}
                        fill
                        sizes="(max-width: 600px) 100vw, 320px"
                        style={{
                          objectFit: "cover"
                        }}
                      />
                    </div>
                  )}
                  <h3 style={{ margin: "0 0 0.4rem" }}>
                    {item.title.english || item.title.romaji || "Untitled"}
                  </h3>
                  <p className="muted" style={{ fontSize: "0.85rem" }}>
                    {item.description
                      ?.replace(/<br>/g, " ")
                      ?.replace(/<\/?i>/g, "")
                      ?.slice(0, 180) ?? "No synopsis available."}
                    {item.description && item.description.length > 180 ? "…" : ""}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span className="tag">Score: {item.averageScore ?? "?"}</span>
                    <span className="tag">💥 {item.popularity?.toLocaleString() ?? "?"}</span>
                    <span className="tag">
                      Next:{" "}
                      {item.nextAiringEpisode
                        ? `Ep ${item.nextAiringEpisode.episode}`
                        : item.episodes
                          ? `${item.episodes} eps`
                          : "TBA"}
                    </span>
                  </div>
                  <div className="muted" style={{ marginTop: "0.5rem" }}>
                    {item.genres?.slice(0, 4).join(" • ") || "Unclassified"}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="page-footer">
        Auto-generated with AniList data • Updated {new Date().toLocaleTimeString()}
      </footer>
    </div>
  );
}
