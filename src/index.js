// src/index.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// --- Configuration ---
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.DEEPL_API_KEY;
const API_URL = API_KEY?.includes(":fx")
  ? "https://api-free.deepl.com/v2/translate" // clé Free (suffixe :fx)
  : "https://api.deepl.com/v2/translate";      // clé Pro (pas de :fx)

if (!API_KEY) {
  console.warn("⚠️  Aucune clé DEEPL_API_KEY trouvée dans les variables d'environnement Render !");
}

// --- Vérification racine ---
app.get("/", (req, res) => {
  res.json({
    ok: true,
    hasKey: !!API_KEY,
    envKeys: Object.keys(process.env).filter(k => k.startsWith("DEEPL")),
    apiUrl: API_URL
  });
});

// --- Proxy DeepL ---
app.post("/deepl-proxy", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "Clé API DeepL manquante." });
    }

    let { text, texts, target_lang } = req.body || {};
    const target = (target_lang || "NL").toUpperCase();

    // Normalisation en tableau
    if (!texts) {
      if (typeof text === "string") texts = [text];
      else if (Array.isArray(text)) texts = text;
    }

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: "Paramètre 'text' ou 'texts[]' requis", body: req.body });
    }

    // Sécurité : max 50 textes par requête
    texts = texts.slice(0, 50);

    const params = new URLSearchParams();
    texts.forEach(t => params.append("text", t));
    params.append("target_lang", target);

    const deeplRes = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    const raw = await deeplRes.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = { error: "Invalid JSON from DeepL", raw };
    }

    res.set("Access-Control-Allow-Origin", "*");
    res.status(deeplRes.status).json(json);

  } catch (e) {
    console.error("Erreur proxy DeepL:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 DeepL proxy actif sur le port ${PORT}`);
});
