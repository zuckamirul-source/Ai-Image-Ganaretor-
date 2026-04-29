import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Standard initialization for AI Studio applets
const defaultGeminiAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type AIProvider = "gemini" | "groq" | "claude" | "deepseek";

export async function generateSvg(
  prompt: string, 
  count: number = 1, 
  apiKey?: string,
  provider: AIProvider = "gemini",
  imageData?: { data: string; mimeType: string }
): Promise<string[]> {
  const systemInstruction = `You are an elite professional SVG vector artist specializing in ultra-high quality illustrations.
TASK: Create EXACTLY ${count} visually distinct, sophisticated variations of the requested prompt.
${imageData ? "ANALYZE THE ATTACHED IMAGE: Use the image as a primary reference for the visual language, layout, and artistic style of your output." : ""}
- STYLE DEPTH: Explore professional styles like Linear Minimalist, Complex Vector, or Tech-Futurist.
- VECTOR PRECISION: Ensure paths are mathematically clean. Use <defs> for reusable gradients.
- OUTPUT: Pure XML SVG code ONLY. JSON key "svgs" containing the array of strings. IMPORTANT: Your entire response must be a single JSON object. No conversational filler.`;

  if (provider === "deepseek") {
    if (!apiKey) throw new Error("DeepSeek API Key is required.");
    
    const deepseek = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.deepseek.com",
      dangerouslyAllowBrowser: true
    });

    const model = "deepseek-chat"; 
    const userMessageContent: any[] = [{ type: "text", text: prompt }];

    if (imageData) {
      userMessageContent[0].text += "\n[Note: An image was uploaded but this provider may have limited vision support. Please rely on the prompt description.]";
    }

    try {
      const response = await deepseek.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userMessageContent as any }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const text = response.choices[0]?.message?.content || "{}";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanText = jsonMatch ? jsonMatch[0] : text;
        const data = JSON.parse(cleanText);
        if (data && Array.isArray(data.svgs)) {
          return data.svgs;
        }
        throw new Error("Invalid output format from DeepSeek.");
      } catch (err) {
        console.error("DeepSeek Parse Error:", text);
        throw new Error("DeepSeek failed to generate valid SVGs.");
      }
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      if (err.status === 403 || errorMsg.includes("403") || errorMsg.includes("permission")) {
        throw new Error("DeepSeek Permission Denied (403): Your API key may be invalid or restricted. Please check your DeepSeek console.");
      }
      if (errorMsg.includes("balance") || errorMsg.includes("insufficient") || errorMsg.includes("quota") || err.status === 402) {
        throw new Error("DeepSeek Insufficient Balance (402): Please check your DeepSeek account credits.");
      }
      throw err;
    }
  }

  if (provider === "claude") {
    if (!apiKey) throw new Error("Anthropic API Key is required for Claude provider.");
    
    const anthropic = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });

    const model = "claude-3-5-sonnet-20241022";
    const userMessageContent: any[] = [{ type: "text", text: prompt }];

    if (imageData) {
      userMessageContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: imageData.mimeType as any,
          data: imageData.data,
        },
      });
    }

    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemInstruction + "\nIMPORTANT: Return ONLY valid JSON. No conversational text.",
        messages: [
          { role: "user", content: userMessageContent }
        ],
        temperature: 0.7,
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : "{}";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanText = jsonMatch ? jsonMatch[0] : text;
        const data = JSON.parse(cleanText);
        if (data && Array.isArray(data.svgs)) {
          return data.svgs;
        }
        throw new Error("Invalid output format from Claude.");
      } catch (err) {
        console.error("Claude Parse Error:", text);
        throw new Error("Claude failed to generate valid SVGs.");
      }
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      if (err.status === 403 || errorMsg.includes("403") || errorMsg.includes("permission")) {
        throw new Error("Claude Permission Denied (403): Your Anthropic key might be restricted or invalid.");
      }
      if (errorMsg.includes("credit balance") || errorMsg.includes("billing") || errorMsg.includes("quota") || err.status === 402) {
        throw new Error("Anthropic Insufficient Balance (402): Your credit balance might be too low. Please check your Anthropic dashboard.");
      }
      if (errorMsg.includes("429")) {
        throw new Error("Anthropic Rate Limit: Too many requests. Please wait a moment.");
      }
      throw err;
    }
  }

  if (provider === "groq") {
    if (!apiKey) throw new Error("Groq API Key is required for Groq provider.");
    
    const groq = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.groq.com/openai/v1",
      dangerouslyAllowBrowser: true 
    });

    const model = imageData ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
    const userMessageContent: any[] = [{ type: "text", text: prompt }];
    
    if (imageData) {
      userMessageContent.push({
        type: "image_url",
        image_url: {
          url: `data:${imageData.mimeType};base64,${imageData.data}`
        }
      });
    }

    try {
      const response = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemInstruction + "\nALWAYS respond in JSON format." },
          { role: "user", content: userMessageContent as any }
        ],
        model,
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const text = response.choices[0]?.message?.content || "{}";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanText = jsonMatch ? jsonMatch[0] : text;
        const data = JSON.parse(cleanText);
        if (data && Array.isArray(data.svgs)) {
          return data.svgs;
        }
        throw new Error("Invalid output format from Groq.");
      } catch (err) {
        console.error("Groq Parse Error:", text);
        throw new Error("Groq failed to generate valid SVGs from analysis.");
      }
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      if (err.status === 403 || errorMsg.includes("403") || errorMsg.includes("permission")) {
        throw new Error("Groq Permission Denied (403): Your key might be restricted or restricted to certain models.");
      }
      if (errorMsg.includes("Failed to generate JSON")) {
        throw new Error("Groq JSON Error: The vision model failed to produce a JSON response for this prompt. Try a simpler description or switch to Gemini.");
      }
      if (errorMsg.includes("balance") || errorMsg.includes("billing") || errorMsg.includes("quota") || err.status === 402) {
        throw new Error("Groq Insufficient Balance (402): Please check your Groq Cloud billing or rate limits.");
      }
      throw err;
    }
  }

// Gemini logic
  const ai = apiKey ? new GoogleGenAI({ apiKey: apiKey }) : defaultGeminiAi;
  
  const contents = imageData 
    ? [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: imageData.data, mimeType: imageData.mimeType } }
          ]
        }
      ]
    : prompt;

  const maxRetries = 3;
  let retryCount = 0;
  let lastError: any;

  while (retryCount <= maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents,
        config: {
          systemInstruction: systemInstruction + "\nReturn ONLY the JSON. No preamble.",
          temperature: 0.9,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              svgs: {
                type: Type.ARRAY,
                description: `An array containing exactly ${count} raw SVG code strings. Each string MUST be a valid, complete XML <svg> element.`,
                items: {
                  type: Type.STRING
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
        throw new Error("Invalid output format from Gemini.");
      } catch (err) {
        console.error("Gemini Parse Error:", text);
        throw new Error("Gemini failed to generate valid SVGs.");
      }
    } catch (err: any) {
      lastError = err;
      const errorMsg = err.message || String(err);
      console.error("Gemini API Error Detail:", errorMsg, err);

      // Check for 403 Permission Denied
      if (err.status === 403 || errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
        throw new Error("Gemini Permission Denied (403): The API key provided does not have access to this model or project. If using a custom key, ensure it is active in Google AI Studio.");
      }

      // Check for 429 Resource Exhausted (Rate Limit)
      // The error can be in message, status, or response.status
      const isRateLimit = 
        errorMsg.includes("429") || 
        err.status === 429 || 
        err.response?.status === 429 ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorMsg.includes("quota");

      if (isRateLimit) {
        if (retryCount < maxRetries) {
          retryCount++;
          // Exponential backoff: 2s, 4s, 8s...
          const baseWait = Math.pow(2, retryCount + 1) * 1000;
          const jitter = Math.random() * 1000;
          const waitTime = baseWait + jitter;
          
          console.warn(`Gemini Rate Limit (429). Retrying in ${Math.round(waitTime)}ms... (Attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw new Error("Gemini API quota exceeded (429). Please wait about 60 seconds before trying again, or provide your own API key in Settings to increase limits.");
      }
      throw err;
    }
  }

  throw lastError;
}
