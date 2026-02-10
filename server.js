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
   MARKET STATE (AUTHORITATIVE)
========================= */
let market = {
  symbol: null,
  candles: [],
  pointer: 0,
  running: false
};

/* =========================
   ACCOUNT STATE
========================= */
let account = {
  startingBalance: 100_000,
  balance: 100_000,
  realizedPnL: 0
};

/* =========================
   POSITIONS
========================= */
let positions = new Map();

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
        name: t.name
      })) || []
    );
  } catch (err) {
    res.status(500).json([]);
  }
});

/* =========================
   FETCH POLYGON CANDLES
========================= */
async function fetchPolygonCandles(symbol) {
  const DELAY_SECONDS = 15 * 60;
  const now = Math.floor(Date.now() / 1000) - DELAY_SECONDS;

  const multiplier = 1;
  const limit = 300;
  const from = now - multiplier * 60 * limit;

  const url =
    `https://api.polygon.io/v2/aggs/ticker/${symbol}` +
    `/range/${multiplier}/minute/${from}/${now}` +
    `?adjusted=true&sort=asc&limit=${limit}&apiKey=${POLYGON_KEY}`;

  const r = await fetch(url);
  const data = await r.json();

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error("No candle data");
  }

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
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const candles = await fetchPolygonCandles(symbol.toUpperCase());

    market.symbol = symbol.toUpperCase();
    market.candles = candles;
    market.pointer = 0;
    market.running = true;

    // reset trading state
    positions.clear();
    account.balance = account.startingBalance;
    account.realizedPnL = 0;

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Market start failed" });
  }
});

/* =========================
   MARKET STREAM (SSE)
========================= */
app.get("/api/market/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const interval = setInterval(() => {
    if (!market.running) return;
    if (market.pointer >= market.candles.length) return;

    const candle = market.candles[market.pointer++];
    res.write(`data: ${JSON.stringify(candle)}\n\n`);
  }, 1000);

  req.on("close", () => clearInterval(interval));
});

/* =========================
   EXECUTE ORDER + PNL
========================= */
app.post("/api/order", (req, res) => {
  const { symbol, side, qty } = req.body;
  if (!symbol || !side || qty <= 0) {
    return res.status(400).json({ error: "Invalid order" });
  }

  const candle = market.candles[market.pointer - 1];
  if (!candle) {
    return res.status(400).json({ error: "No price available" });
  }

  const price = candle.c;
  const cost = price * qty;

  // BUY
  if (side === "BUY") {
    if (account.balance < cost) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    account.balance -= cost;

    if (!positions.has(symbol)) {
      positions.set(symbol, {
        symbol,
        qty,
        avgPrice: price
      });
    } else {
      const p = positions.get(symbol);
      const totalCost = p.avgPrice * p.qty + cost;
      p.qty += qty;
      p.avgPrice = totalCost / p.qty;
    }
  }

  // SELL
  if (side === "SELL") {
    if (!positions.has(symbol)) {
      return res.status(400).json({ error: "No position" });
    }

    const p = positions.get(symbol);
    if (p.qty < qty) {
      return res.status(400).json({ error: "Not enough shares" });
    }

    // REALIZED PNL
    const realized = (price - p.avgPrice) * qty;
    account.realizedPnL += realized;
    account.balance += price * qty;

    p.qty -= qty;
    if (p.qty === 0) positions.delete(symbol);
  }

  // UNREALIZED PNL SNAPSHOT
  const unrealized = Array.from(positions.values()).map(p => ({
    ...p,
    unrealizedPnL: (price - p.avgPrice) * p.qty
  }));

  res.json({
    ok: true,
    balance: account.balance,
    realizedPnL: account.realizedPnL,
    positions: unrealized
  });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
});
