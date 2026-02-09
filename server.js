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
    origin: [
      "https://stellar-gecko-96c6ca.netlify.app",
      "http://localhost:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
    ],
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

    const results =
      data.results?.map(t => ({
        symbol: t.ticker,
        name: t.name,
      })) || [];

    res.json(results);
  } catch (err) {
    console.error("❌ Symbol search failed", err);
    res.status(500).json([]);
  }
});

/* =========================
   CANDLES — AUTO FALLBACK
========================= */
app.get("/api/candles", async (req, res) => {
  const { symbol, tf = "15m" } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  // Requested TF → fallback chain
  const tfChain =
    tf === "1m"
      ? [1, 5, 15]
      : tf === "5m"
      ? [5, 15]
      : [Number(tf.replace("m", "")) || 15];

  const now = Math.floor(Date.now() / 1000);

  for (const multiplier of tfChain) {
    const from = now - multiplier * 60 * 150;

    const url =
      `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}` +
      `/range/${multiplier}/minute/${from}/${now}` +
      `?adjusted=true&sort=asc&limit=150&apiKey=${POLYGON_KEY}`;

    console.log(`📡 Polygon request (${multiplier}m):`, url);

    try {
      const r = await fetch(url);
      const data = await r.json();

      if (
        data.status === "OK" &&
        Array.isArray(data.results) &&
        data.results.length > 0
      ) {
        // ✅ SUCCESS — return first valid timeframe
        return res.json({
          results: data.results,
          tf: `${multiplier}m`,
        });
      }
    } catch (err) {
      console.error(`❌ Fetch failed for ${multiplier}m`, err);
    }
  }

  // Absolute last resort — never crash frontend
  console.warn("⚠️ No candles available, returning empty set");
  res.json({ results: [] });
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
});
