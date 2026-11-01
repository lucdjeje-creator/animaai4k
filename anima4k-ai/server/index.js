import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { randomUUID } from "node:crypto";

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const jobs = new Map();

const FAL_KEY = process.env.FAL_KEY;
const TEXT_MODEL = process.env.FAL_TEXT_MODEL || "fal-ai/kling-video/v2.1/standard/text-to-video";
const IMAGE_MODEL = process.env.FAL_IMAGE_MODEL || "fal-ai/kling-video/v2.1/standard/image-to-video";

async function falSubmit(model, input) {
  if (!FAL_KEY) throw new Error("FAL_KEY não configurada no arquivo .env");
  const response = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.message || `Falha no provedor (${response.status})`);
  return data;
}
async function falStatus(statusUrl) {
  const r = await fetch(statusUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Não foi possível consultar o status");
  return d;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, provider: "fal.ai", configured: Boolean(FAL_KEY) }));

app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    const { prompt, style = "automatic", aspectRatio = "16:9", duration = "5", resolution = "1080p" } = req.body;
    if (!prompt || prompt.trim().length < 4) return res.status(400).json({ error: "Descreva a cena com pelo menos 4 caracteres." });
    if (!["5","10"].includes(String(duration))) return res.status(400).json({ error: "Duração permitida neste preset: 5 ou 10 segundos." });
    const image = req.file;
    if (image && !["image/png","image/jpeg","image/webp"].includes(image.mimetype)) return res.status(400).json({ error: "Formato de imagem inválido." });

    // Upload opcional da referência para armazenamento público temporário do fal.ai.
    // Para produção, prefira armazenamento próprio com URLs assinadas e política de retenção.
    let imageUrl;
    if (image) {
      const up = await fetch("https://fal.run/fal-ai/storage/upload", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": image.mimetype },
        body: image.buffer
      });
      const ud = await up.json();
      if (!up.ok) throw new Error(ud.detail || "Falha ao enviar imagem de referência");
      imageUrl = ud.url;
    }

    const model = imageUrl ? IMAGE_MODEL : TEXT_MODEL;
    const stylePrompt = style && style !== "automatic" ? `${prompt}. Visual style: ${style}.` : prompt;
    const input = {
      prompt: stylePrompt,
      duration: Number(duration),
      aspect_ratio: aspectRatio,
      ...(imageUrl ? { image_url: imageUrl } : {})
    };
    const submitted = await falSubmit(model, input);
    const id = randomUUID();
    jobs.set(id, {
      id, status: "IN_QUEUE", model, request_id: submitted.request_id,
      status_url: submitted.status_url, response_url: submitted.response_url,
      requestedResolution: resolution, createdAt: new Date().toISOString()
    });
    res.status(202).json({ id, status: "IN_QUEUE", message: "Geração enviada ao provedor." });
  } catch (e) {
    res.status(500).json({ error: e.message || "Erro ao iniciar geração." });
  }
});

app.get("/api/jobs/:id", async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Trabalho não encontrado neste servidor." });
  try {
    const status = await falStatus(job.status_url);
    job.status = status.status || job.status;
    if (job.status === "COMPLETED" && job.response_url) {
      const result = await falStatus(job.response_url);
      job.video = result.video?.url || result.output?.video?.url || result.video_url || null;
      job.result = result;
    }
    if (job.status === "FAILED") job.error = status.error || "O provedor não conseguiu gerar o vídeo.";
    jobs.set(job.id, job);
    res.json({ id: job.id, status: job.status, videoUrl: job.video || null, error: job.error || null, requestedResolution: job.requestedResolution });
  } catch (e) {
    res.status(502).json({ error: e.message || "Erro consultando o provedor." });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`ANIMAI 4K AI rodando em http://localhost:${port}`));
