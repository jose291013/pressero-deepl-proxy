import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();

// Sécurité & middlewares
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("tiny"));

// Route test ping
app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    hasKey: !!process.env.DEEPL_API_KEY,
    envKeys: Object.keys(process.env).filter(k =>
      k.includes("DEEPL") || k.includes("NODE")
    ),
  });
});

// Route principale proxy DeepL
app.post("/deepl-proxy", async (req, res) => {
  const { text, target_lang } = req.body || {};
  const apiKey = process.env.DEEPL_API_KEY;

  console.log("📥 Requête reçue:", req.body);
  console.log("🔑 API key:", apiKey ? "OK" : "MISSING");

  if (!apiKey) return res.status(500).json({ error: "DEEPL_API_KEY manquante" });
  if (!text) return res.status(400).json({ error: "Paramètre 'text' requis", body: req.body });

  try {
    const deeplRes = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        text,
        target_lang: target_lang || "NL"
      })
    });

    const rawText = await deeplRes.text();
    console.log("📤 Réponse brute DeepL:", rawText);

    const data = JSON.parse(rawText);
    res.set("Access-Control-Allow-Origin", "*");
    res.json(data);

  } catch (e) {
    console.error("Erreur DeepL:", e);
    res.status(500).json({ error: "Erreur proxy DeepL", details: e.message });
  }
});

// Lancement serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 DeepL proxy actif sur le port ${PORT}`));
