import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set limits higher to support uploaded diagram images
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Initialize Gemini API client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // Endpoint to solve math, physics, or chemistry questions
  app.post("/api/solve", async (req: express.Request, res: express.Response) => {
    try {
      const { prompt, subject, image, mimeType } = req.body;

      if (!prompt && !image) {
        return res.status(400).json({ error: "تکایە بابەتەک یان وێنەیەک ل بار بکە" });
      }

      // System prompt written specifically for Kurdish Badini academic context
      const systemInstruction = `تو هاریکارەکێ زانستی یێ تایبەتی. ئەرکێ تە چارەسەرکرن و شلوڤەکرنا بابەتێن بیرکاری، فیزیا و کیمیایێ یە ب زمانەکێ کوردی زاراڤێ بەهدینی یێ پەتی (Pure Badini Kurdish).

رێسایێن کارکرنێ:
١. زمان: تەنێ ب زمانێ کوردی زاراڤێ بەهدینی (بادینی) یێ پەتی بنڤیسە. بکارئینانا پەیڤێن زاراڤێ سۆرانێ یان تێکەلی ب تەمامی قەدەغەیە.
٢. پەیڤێن قەدەغەکری و جێگرێن وان:
- پەیڤا 'وەڵام' قەدەغەیە -> جێگرێ وێ: 'بەرسڤ'
- پەیڤا 'ڕوونکردنەوە' قەدەغەیە -> جێگرێ وێ: 'شلوڤەکرن' یان 'روونکرن'
- پەیڤا 'زانیاری' قەدەغەیە -> جێگرێ وێ: 'پێزانین'
- پەیڤا 'ئاکادمی' یان 'ئاکادیمی' قەدەغەیە -> جێگرێ وێ: 'ئەکادیمی'
- پەیڤێن سۆرانی یێن دی وەکی 'بۆچی' (بکاربینە 'چما' یان 'بۆچی' ب دەنگێ بادینی)، 'دەکات' (بکاربینە 'دکەت')، 'دەکەین' (بکاربینە 'دکەین') ب تەمامی قەدەغەنە.
٣. پاقژکرنا نیشانان: هەر نیشانەکا دۆلاری ($) یان پاشگرێن کۆدێ د ناڤ بەرسڤێ دا نەئینە. بەرسڤ دڤێت گەلەکا سادە و رێکخستی بیت.
٤. رێبازا چارەسەرکرنێ: هەر پرسیارەکێ ب ڤی شێوازێ پێنگاڤ ب پێنگاڤ دابەش بکە:
- پێنگاڤا ئێکێ: دەستنیشانکرنا کێشێ یان ئاریشێ.
- پێنگاڤا دوویێ: دانانا هاوکێشێ یان یاسایێ.
- پێنگاڤا سێیێ: قۆناغێن چارەسەرکرنێ ب شێوازێ لیستەکا روون.
- ئەنجام: دیارکرنا بەرسڤا دوماهییێ ب شێوازەکێ بەرچاو.

دیزاین: بەرسڤ دڤێت ب ساناهی ل سەر شاشا موبایلێ بهێتە خواندن و رێکخستنەکا جوان هەبیت.
رێگرتن: هەر دەما پرسیارەکا نەزانستی هاتە کرن، ب رێز و ب بەهدینییا پەتی بێژە: 'ئەز دێ تەنێ ل سەر بابەتێن زانستێن سروشتی هاریکاریا تە کەم.'`;

      let contents: any;

      if (image && mimeType) {
        const imagePart = {
          inlineData: {
            mimeType: mimeType,
            data: image,
          },
        };
        const textPart = {
          text: prompt || `تکایە ل ڤی بابەتێ ${subject} وێنەی شیکار بکە و ب بەرفرهەهی روون بکە ژ بۆ من.`,
        };
        contents = { parts: [imagePart, textPart] };
      } else {
        contents = prompt;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2, // slightly lower for scientific/math precision
        },
      });

      const solution = response.text;
      res.json({ solution });
    } catch (error: any) {
      console.error("Gemini solving error:", error);
      res.status(500).json({ error: error?.message || "خەلەتیەک ڕوویدا لە کاتی پەیوەندیکردن بە ژیریی دەستکردەوە." });
    }
  });

  // Integrate Vite for dev vs prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
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

startServer();
