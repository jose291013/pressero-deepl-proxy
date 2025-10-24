// src/index.js (DeepL PRO + batch + cache sans dépendances)
import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.DEEPL_API_KEY;
const API_URL = "https://api.deepl.com/v2/translate"; // PRO

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/** Mini cache TTL sans dépendances */
class TinyCache {
  constructor(ttlSeconds = 3600) {
    this.ttl = ttlSeconds * 1000;
    this.store = new Map();
  }
  _now() { return Date.now(); }
  set(key, value) { this.store.set(key, { value, exp: this._now() + this.ttl }); }
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.exp < this._now()) { this.store.delete(key); return undefined; }
    return hit.value;
  }
  keys() { return Array.from(this.store.keys()); }
}
const cache = new TinyCache(3600); // 1h

// Healthcheck
app.get("/", (req, res) => {
  res.json({
    ok: true,
    mode: "PRO",
    hasKey: !!API_KEY,
    cacheItems: cache.keys().length
  });
});

// Proxy DeepL PRO (batch + cache)
app.post("/deepl-proxy", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);

  const { text, target_lang, texts } = req.body || {};
  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "DEEPL_API_KEY manquante" });
  if (!text && !texts) return res.status(400).json({ error: "Paramètre 'text' ou 'texts[]' requis", body: req.body });

  try {
    // Adaptation pour DeepL batch
    const params = new URLSearchParams();
    if (Array.isArray(texts)) {
      texts.forEach(t => params.append("text", t));
    } else if (text) {
      params.append("text", text);
    }
    params.append("target_lang", target_lang || "NL");

    const deeplRes = await fetch("https://api.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params
    });

    const data = await deeplRes.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (e) {
    console.error("Erreur DeepL:", e);
    res.status(500).json({ error: "Erreur proxy DeepL", details: e.message });
  }
});


app.listen(PORT, () => console.log(`🚀 DeepL Pro proxy actif sur le port ${PORT}`));
