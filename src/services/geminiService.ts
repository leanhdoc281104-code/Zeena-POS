import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function identifyProductByBarcode(barcode: string): Promise<{ name: string; price?: number; category?: string } | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify the product for barcode: ${barcode}. 
      Return details in JSON format: { "name": "...", "suggestedPrice": 0, "category": "..." }. 
      If unsure, return an empty object.
      The store currency is Sudanese Pounds (SDG / ج.س).`,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      if (data.name) {
        return {
          name: data.name,
          price: data.suggestedPrice,
          category: data.category
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini identifying error:", error);
    return null;
  }
}
