import express from "express";
import multer from "multer";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { PDFDocument } from "pdf-lib";

const app = express();
app.set("trust proxy", true);

// ——— CORS ———
// Mets EXACTEMENT tes origines Pressero (sans slash final), séparées par des virgules si plusieurs
const normalize = (u) => (u || "").trim().replace(/\/$/, "");
const allowed = (process.env.CORS_ORIGIN || "").split(",").map(normalize).filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);       // server→server (curl)
    if (!allowed.length) return cb(null, true); // dev: tout autorisé si non défini
    if (allowed.includes(normalize(origin))) return cb(null, true);
    return cb(new Error("Not allowed by CORS: " + origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // prévol

// ——— Helmet ———
// Autoriser la consultation cross-origin de la ressource binaire (sinon CORP bloque côté navigateur)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // inutile pour cet usage binaire
}));

app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
});

app.get("/", (_, res) => res.status(200).send("OK"));
app.get("/healthz", (_, res) => res.status(200).json({ status: "ok" }));

// Endpoint principal : duplique la page 1 si le PDF a 1 seule page
app.post("/pdf/duplicate-if-single-page", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Missing file" });

    const input = req.file.buffer;

    // Laisse pdf-lib valider le PDF (plus fiable que tester '%PDF')
    let pdf;
    try {
      pdf = await PDFDocument.load(input, { ignoreEncryption: true });
    } catch (e) {
      console.error("PDF load error:", e?.message);
      return res.status(400).json({ error: "Unable to read PDF" });
    }

    const count = pdf.getPageCount();

    if (count === 1) {
      const [p1] = await pdf.copyPages(pdf, [0]);
      pdf.addPage(p1);
      const out = await pdf.save();
      return res
        .type("application/pdf")
        .set("Cache-Control", "no-store")
        .send(Buffer.from(out));
    }

    // Si le PDF >= 2 pages, renvoyer tel quel
    return res
      .type("application/pdf")
      .set("Cache-Control", "no-store")
      .send(input);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Duplication failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[pdf-duo] listening on :${PORT}`));
