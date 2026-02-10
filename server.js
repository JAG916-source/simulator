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
   GLOBAL MARKET STATE
   🔒 MARKET AUTHORITY
========================= */
let market = {
  symbol: null,
  candles: [],
  pointer: 0,
  running: false
};

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   HEALTH
========================= */
app.get("/", (_, res) => {
  res.send("🚀 Simulator backend running");
});

/* =========================
   SYMBOL SEARCH (UNCHANGED)
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
        name: t.name
      })) || []
    );
  } catch (err) {
    console.error("❌ Symbol search failed", err);
    res.status(500).json([]);
  }
});

/* =========================
   INTERNAL: FETCH POLYGON CANDLES
========================= */
async function fetchPolygonCandles(symbol) {
  const DELAY_SECONDS = 15 * 60;
  const now = Math.floor(Date.now() / 1000) - DELAY_SECONDS;

  const multiplier = 1; // 1-minute candles
  const limit = 300;
  const from = now - multiplier * 60 * limit;

  const url =
    `https://api.polygon.io/v2/aggs/ticker/${symbol}` +
    `/range/${multiplier}/minute/${from}/${now}` +
    `?adjusted=true&sort=asc&limit=${limit}&apiKey=${POLYGON_KEY}`;

  const r = await fetch(url);
  const data = await r.json();

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error("No candle data returned");
  }

  // Normalize candles
  return data.results.map(c => ({
    t: c.t,
    o: c.o,
    h: c.h,
    l: c.l,
    c: c.c,
    v: c.v
  }));
}

/* =========================
   START / RESET MARKET
========================= */
app.post("/api/market/start", async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol" });
  }

  try {
    console.log(`📡 Fetching Polygon candles for ${symbol}...`);
    const candles = await fetchPolygonCandles(symbol.toUpperCase());

    market.symbol = symbol.toUpperCase();
    market.candles = candles;
    market.pointer = 0;
    market.running = true;

    console.log(`✅ Market started: ${symbol} (${candles.length} candles)`);

    res.json({ ok: true, candles: candles.length });
  } catch (err) {
    console.error("❌ Market start failed:", err.message);
    res.status(500).json({ error: "Failed to start market" });
  }
});

/* =========================
   MARKET STREAM (SSE)
========================= */
app.get("/api/market/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  console.log("📺 Client connected to market stream");

  const interval = setInterval(() => {
    if (!market.running) return;
    if (market.pointer >= market.candles.length) return;

    const candle = market.candles[market.pointer++];
    res.write(`data: ${JSON.stringify(candle)}\n\n`);
  }, 1000); // 1 candle per second (adjust later)

  req.on("close", () => {
    clearInterval(interval);
    console.log("📴 Client disconnected from stream");
  });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
});
