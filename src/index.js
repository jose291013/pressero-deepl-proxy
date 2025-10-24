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
  try {
    if (!API_KEY) return res.status(500).json({ error: "DEEPL_API_KEY manquante" });

    // texts[] (array) OU text (string)
    const texts = Array.isArray(req.body["texts[]"])
      ? req.body["texts[]"]
      : (typeof req.body.text === "string" ? [req.body.text] : []);
    if (texts.length === 0) {
      return res.status(400).json({ error: "Paramètre 'text' ou 'texts[]' requis", body: req.body || {} });
    }

    const target = (req.body.target_lang || "FR").toUpperCase();

    // Clef de cache (simple, mais efficace)
    const cacheKey = target + "::" + texts.join("||");
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ translations: cached, cached: true });
    }

    // Envoi batch à DeepL
    const form = new URLSearchParams();
    texts.slice(0, 50).forEach(t => form.append("text", t)); // max 50
    form.append("target_lang", target);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    });

    const raw = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: "DeepL error", status: response.status, raw });
    }

    let data;
    try { data = JSON.parse(raw); }
    catch { return res.status(502).json({ error: "Invalid JSON from DeepL", raw }); }

    // Mise en cache des traductions (tableau tel quel)
    if (Array.isArray(data.translations)) {
      cache.set(cacheKey, data.translations);
    }

    res.set("Access-Control-Allow-Origin", "*");
    return res.json(data);
  } catch (err) {
    console.error("❌ Erreur proxy DeepL Pro:", err);
    return res.status(500).json({ error: "Erreur proxy DeepL Pro", details: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 DeepL Pro proxy actif sur le port ${PORT}`));
