// src/index.js
import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import NodeCache from "node-cache";

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.DEEPL_API_KEY;
const API_URL = "https://api.deepl.com/v2/translate"; // ✅ endpoint PRO
const cache = new NodeCache({ stdTTL: 3600 }); // 1h de cache

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Proxy DeepL Pro optimisé
app.post("/deepl-proxy", async (req, res) => {
  try {
    const texts = Array.isArray(req.body["texts[]"])
      ? req.body["texts[]"]
      : [req.body.text].filter(Boolean);
    const target = req.body.target_lang || "FR";
    if (!texts.length) return res.status(400).json({ error: "Paramètre 'text' ou 'texts[]' requis" });

    // Cache mémoire
    const cacheKey = target + ":" + texts.join("||");
    if (cache.has(cacheKey)) {
      return res.json({ translations: cache.get(cacheKey), cached: true });
    }

    // Requête DeepL Pro
    const form = new URLSearchParams();
    texts.forEach(t => form.append("text", t));
    form.append("target_lang", target);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    });

    if (!response.ok) {
      const msg = await response.text();
      throw new Error(`DeepL ${response.status}: ${msg}`);
    }

    const data = await response.json();
    cache.set(cacheKey, data.translations);
    res.json(data);
  } catch (err) {
    console.error("❌ Erreur proxy:", err);
    res.status(500).json({ error: "Erreur proxy DeepL Pro", details: err.message });
  }
});

// Test de santé
app.get("/", (req, res) => {
  res.json({ ok: true, mode: "PRO", cacheItems: cache.keys().length });
});

app.listen(PORT, () => console.log(`🚀 DeepL Pro proxy actif sur le port ${PORT}`));
