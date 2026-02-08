import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

app.get("/", (req, res) => {
  res.send("Simulator backend running");
});

// 🔹 Candle endpoint (Polygon-style passthrough mock)
app.get("/api/candles", async (req, res) => {
  const { symbol, tf = "15m" } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol" });
  }

  // TEMP MOCK so frontend works immediately
  const now = Date.now();
  const candles = Array.from({ length: 100 }, (_, i) => ({
    t: now - (100 - i) * 60_000,
    o: 15 + Math.random(),
    h: 16 + Math.random(),
    l: 14 + Math.random(),
    c: 15 + Math.random(),
    v: Math.floor(Math.random() * 1000)
  }));

  res.json({
    results: candles
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
