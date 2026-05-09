import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing middleware
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/ai/diagnose", async (req, res) => {
    const { deviceType, brand, model, faultDescription } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    try {
      const { GoogleGenerativeAI } = await import("@google/genai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model_ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Sen bir teknik servis uzmanısın. Şu cihaz ve arıza için olası tanıları ve çözüm adımlarını (parça değişimi, kontrol noktaları vb.) madde madde ve kısa bir şekilde öner:
      Cihaz Türü: ${deviceType}
      Marka/Model: ${brand} ${model}
      Arıza Açıklaması: ${faultDescription}`;

      const result = await model_ai.generateContent(prompt);
      const response = await result.response;
      res.json({ suggestion: response.text() });
    } catch (error) {
      console.error('AI Error:', error);
      res.status(500).json({ error: "Yapay zeka analizi sırasında bir hata oluştu" });
    }
  });

  // Example API route
  app.get("/api/example", (req, res) => {
    res.json({ message: "This is a backend API route" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
