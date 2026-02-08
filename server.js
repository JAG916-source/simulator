import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔒 CORS — allow your Netlify frontend
app.use(
  cors({
    origin: [
      "https://stellar-gecko-96c6ca.netlify.app"
    ],
    methods: ["GET"],
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Simulator backend running");
});

/* ===============================
   SYMBOL SEARCH (FIXES SEARCH BAR)
================================ */
app.get("/api/symbol-search", async (req, res) => {
  const q = req.query.q?.toUpperCase();

  if (!q) {
    return res.json([]);
  }

  // TEMP MOCK — frontend expects this shape
  const results = [
    { symbol: "AAPL", name: "Apple Inc." },
    { symbol: "NVDA", name: "NVIDIA Corporation" },
    { symbol: "MSFT", name: "Microsoft Corp." },
    { symbol: "TSLA", name: "Tesla Inc." },
  ].filter(s => s.symbol.startsWith(q));

  res.json(results);
});

/* ===============================
   CANDLES (WORKING)
================================ */
app.get("/api/candles", async (req, res) => {
  const { symbol, tf = "15m" } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol" });
  }

  const now = Date.now();
  const candles = Array.from({ length: 100 }, (_, i) => ({
    t: now - (100 - i) * 60_000,
    o: 15 + Math.random(),
    h: 16 + Math.random(),
    l: 14 + Math.random(),
    c: 15 + Math.random(),
    v: Math.floor(Math.random() * 1000),
  }));

  res.json({ results: candles });
});

app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
