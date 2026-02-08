import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3001;

/* =========================
   CORS — THIS IS THE FIX
========================= */

app.use(
  cors({
    origin: [
      "https://stellar-gecko-96c6ca.netlify.app", // your Netlify site
      "http://localhost:5173",                   // local dev (Vite)
      "http://localhost:3000"
    ],
    methods: ["GET"],
    allowedHeaders: ["Content-Type"]
  })
);

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.send("Simulator backend running");
});

/* =========================
   SYMBOL SEARCH (REQUIRED)
========================= */

app.get("/api/symbol-search", (req, res) => {
  const q = (req.query.q || "").toUpperCase();

  if (!q) {
    return res.json({ results: [] });
  }

  // TEMP MOCK SEARCH so frontend works immediately
  const symbols = [
    { ticker: "AAPL", name: "Apple Inc." },
    { ticker: "NVDA", name: "NVIDIA Corporation" },
    { ticker: "MSFT", name: "Microsoft Corp." },
    { ticker: "TSLA", name: "Tesla Inc." },
    { ticker: "AMD", name: "Advanced Micro Devices" }
  ];

  const results = symbols.filter(s =>
    s.ticker.startsWith(q)
  );

  res.json({ results });
});

/* =========================
   CANDLES ENDPOINT
========================= */

app.get("/api/candles", async (req, res) => {
  const { symbol, tf = "15m" } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol" });
  }

  // TEMP MOCK DATA (Polygon-style)
  const now = Date.now();
  const candles = Array.from({ length: 120 }, (_, i) => ({
    t: now - (120 - i) * 60_000,
    o: 15 + Math.random(),
    h: 16 + Math.random(),
    l: 14 + Math.random(),
    c: 15 + Math.random(),
    v: Math.floor(Math.random() * 1000)
  }));

  res.json({ results: candles });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
