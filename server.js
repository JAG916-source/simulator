import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;
const POLYGON_KEY = process.env.POLYGON_API_KEY;

if (!POLYGON_KEY) {
  console.error("❌ POLYGON_API_KEY is missing");
}

/* =========================
   CORS
========================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET"],
  })
);

app.use(express.json());

/* =========================
   HEALTH
========================= */
app.get("/", (_, res) => {
  res.send("Simulator backend running");
});

/* =========================
   SYMBOL SEARCH
========================= */
app.get("/api/symbol-search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);

  try {
    const url =
      `https://api.polygon.io/v3/reference/tickers` +
      `?search=${encodeURIComponent(q)}` +
      `&market=stocks&active=true&limit=10&apiKey=${POLYGON_KEY}`;

    const r = await fetch(url);
    const data = await r.json();

    res.json(
      data.results?.map(t => ({
        symbol: t.ticker,
        name: t.name,
      })) || []
    );
  } catch (err) {
    console.error("❌ Symbol search failed", err);
    res.status(500).json([]);
  }
});

/* =========================
   CANDLES (15-MIN DELAY)
========================= */
app.get("/api/candles", async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  const DELAY_SECONDS = 15 * 60;
  const now = Math.floor(Date.now() / 1000) - DELAY_SECONDS;

  const multiplier = 1; // 1-minute candles (TradingView style)
  const limit = 300;
  const from = now - multiplier * 60 * limit;

  const url =
    `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}` +
    `/range/${multiplier}/minute/${from}/${now}` +
    `?adjusted=true&sort=asc&limit=${limit}&apiKey=${POLYGON_KEY}`;

  try {
    const r = await fetch(url);
    const data = await r.json();

    if (data.status === "OK" && data.results?.length) {
      return res.json({ results: data.results });
    }

    // WEEKEND / HOLIDAY FALLBACK
    res.json({ results: [] });
  } catch (err) {
    console.error("❌ Candle fetch failed", err);
    res.status(500).json({ results: [] });
  }
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
});
