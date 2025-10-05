import express from "express";
import multer from "multer";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { PDFDocument } from "pdf-lib";


const app = express();
app.set("trust proxy", true);


// CORS sécurisé : définissez CORS_ORIGIN="https://votre-domaine-pressero" (ou plusieurs, séparés par des virgules)
const allowed = (process.env.CORS_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
const corsOptions = {
origin: function (origin, cb) {
if (!origin) return cb(null, true); // autorise tests server-to-server
if (allowed.length === 0) return cb(null, true); // si non défini → tout autoriser (dev)
if (allowed.includes(origin)) return cb(null, true);
return cb(new Error("Not allowed by CORS: " + origin));
},
methods: ["GET", "POST", "OPTIONS"],
allowedHeaders: ["Content-Type", "Accept"],
credentials: false
};
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));


const upload = multer({
storage: multer.memoryStorage(),
limits: { fileSize: 60 * 1024 * 1024 } // 60MB
});


function isPdf(buffer) {
if (!buffer || buffer.length < 4) return false;
const header = buffer.subarray(0, 4).toString();
return header === "%PDF";
}


app.get("/", (_, res) => res.status(200).send("OK"));
app.get("/healthz", (_, res) => res.status(200).json({ status: "ok" }));


// Endpoint principal : duplique la page 1 si le PDF a 1 seule page
app.post("/pdf/duplicate-if-single-page", upload.single("file"), async (req, res) => {
try {
if (!req.file) return res.status(400).json({ error: "Missing file" });


const input = req.file.buffer;
if (!isPdf(input)) return res.status(400).json({ error: "File is not a valid PDF" });


const pdf = await PDFDocument.load(input);
const count = pdf.getPageCount();


if (count === 1) {
const [p1] = await pdf.copyPages(pdf, [0]);
pdf.addPage(p1);
const out = await pdf.save();
res.setHeader("Content-Type", "application/pdf");
res.setHeader("Cache-Control", "no-store");
return res.status(200).send(Buffer.from(out));
}


// Si le PDF >= 2 pages, renvoyer tel quel
res.setHeader("Content-Type", "application/pdf");
res.setHeader("Cache-Control", "no-store");
return res.status(200).send(input);
} catch (e) {
console.error(e);
return res.status(500).json({ error: "Duplication failed" });
}
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[pdf-duo] listening on :${PORT}`));