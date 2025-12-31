
import { GoogleGenAI, Type, Modality } from "@google/genai";

export class GeminiService {
  private getAi() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  // Chat dengan Pencarian & Maps
  async chatWithGrounding(query: string, sources: string[], useSearch = false, useMaps = false, location?: { latitude: number, longitude: number }) {
    const ai = this.getAi();
    const context = sources.length > 0 ? `Context:\n${sources.join("\n\n---\n\n")}\n\n` : '';
    const model = useMaps ? 'gemini-2.5-flash' : 'gemini-3-flash-preview';
    
    const tools: any[] = [];
    if (useSearch) tools.push({ googleSearch: {} });
    if (useMaps) tools.push({ googleMaps: {} });

    const config: any = { tools: tools.length > 0 ? tools : undefined };
    if (useMaps && location) {
      config.toolConfig = { retrievalConfig: { latLng: { latitude: location.latitude, longitude: location.longitude } } };
    }

    const response = await ai.models.generateContent({
      model,
      contents: context + query,
      config
    });

    return {
      text: response.text || "",
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  }

  // Mode Berpikir (Thinking Mode) - Gemini 3 Pro
  async complexReasoning(query: string, sources: string[]) {
    const ai = this.getAi();
    const context = sources.join("\n\n---\n\n");
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Gunakan konteks ini untuk menjawab secara mendalam:\n${context}\n\nPertanyaan: ${query}`,
      config: { thinkingConfig: { thinkingBudget: 32768 } }
    });
    return { text: response.text || "" };
  }

  // Analisis Gambar & Video
  async analyzeMultimedia(prompt: string, fileData: string, mimeType: string) {
    const ai = this.getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [{ inlineData: { data: fileData, mimeType } }, { text: prompt }]
      }
    });
    return response.text;
  }

  // Gambar High Quality (Nano Banana Pro)
  async generateImagePro(prompt: string, size: "1K" | "2K" | "4K" = "1K", aspectRatio: "1:1" | "16:9" | "9:16" = "1:1") {
    const ai = this.getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { imageSize: size, aspectRatio } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Gagal membuat gambar");
  }

  // Edit Gambar (Nano Banana)
  async editImage(base64Image: string, mimeType: string, prompt: string) {
    const ai = this.getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ inlineData: { data: base64Image, mimeType } }, { text: prompt }]
      }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Gagal mengedit gambar");
  }

  // Video Veo
  async generateVideoVeo(prompt: string, aspectRatio: '16:9' | '9:16', image?: { data: string, mimeType: string }) {
    const ai = this.getAi();
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      image: image ? { imageBytes: image.data, mimeType: image.mimeType } : undefined,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    return `${downloadLink}&key=${process.env.API_KEY}`;
  }

  // Analisis Sumber (Studio Tools)
  async generateExecutiveSummary(sources: string[]) {
    const ai = this.getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buat ringkasan eksekutif profesional dari materi berikut:\n\n${sources.join("\n\n")}`
    });
    return response.text;
  }

  // Fix: Added generateReport method which was missing but called in StudioHub
  async generateReport(sources: string[]) {
    const ai = this.getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buat laporan akademik terstruktur, formal, dan mendalam berdasarkan materi penelitian berikut:\n\n${sources.join("\n\n")}`
    });
    return response.text;
  }

  // Improved generateMindMap with formal responseSchema as per guidelines
  async generateMindMap(sources: string[]) {
    const ai = this.getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buat Mind Map interaktif (JSON) dengan nodes (id, label, description) dan edges (source, target) dari materi: ${sources.join("\n\n")}.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'ID unik node' },
                  label: { type: Type.STRING, description: 'Label visual node' },
                  description: { type: Type.STRING, description: 'Deskripsi detail konsep' }
                },
                required: ["id", "label", "description"]
              }
            },
            edges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING, description: 'ID node asal' },
                  target: { type: Type.STRING, description: 'ID node tujuan' }
                },
                required: ["source", "target"]
              }
            }
          },
          required: ["nodes", "edges"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  }

  async generatePodcast(sources: string[]) {
    const ai = this.getAi();
    const prompt = `Konversi materi ini menjadi obrolan podcast seru antara Joe (Penanya) dan Jane (Ahli):\n\n${sources.join("\n\n")}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: 'Joe', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
              { speaker: 'Jane', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
            ]
          }
        }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  }

  async summarizeSource(content: string) {
    const ai = this.getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Ringkas teks ini dalam satu kalimat padat:\n\n${content}`
    });
    return response.text;
  }

  async describeImage(base64Data: string, mimeType: string) {
    const ai = this.getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Jelaskan isi gambar ini secara detail untuk keperluan riset." }
        ]
      }
    });
    return response.text;
  }
}

export const gemini = new GeminiService();
