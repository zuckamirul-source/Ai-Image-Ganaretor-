import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: API key is loaded from the environment
let ai: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

export async function generateSvg(prompt: string, count: number = 1): Promise<string[]> {
  const client = getGeminiClient();
  
  const systemInstruction = `You are an expert SVG generator. The user will ask for an image, icon, or illustration.
Create EXACTLY ${count} visually distinct variations of the requested SVG.
Each variation should have different colors, layouts, or styles while still matching the core prompt.
Use appropriate colors, gradients, paths, and viewbox. The SVGs should scale well. Make them visually appealing and responsive.`;

  const response = await client.models.generateContent({
    model: "gemini-flash-latest",
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.9,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          svgs: {
            type: "ARRAY",
            description: `An array containing exactly ${count} raw SVG code strings. Each string MUST be a valid, complete XML <svg> element.`,
            items: {
              type: "STRING"
            }
          }
        },
        required: ["svgs"]
      }
    },
  });

  const text = response.text || "{}";
  try {
    const data = JSON.parse(text);
    if (data && Array.isArray(data.svgs)) {
      return data.svgs;
    }
    throw new Error("Invalid output format from AI.");
  } catch (err) {
    console.error("Failed to parse SVGs:", text);
    throw new Error("Failed to generate SVGs. Please try again.");
  }
}
