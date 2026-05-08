
import { GoogleGenAI } from "@google/genai";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405 }
    );
  }

  try {
    const { message, context } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400 }
      );
    }

    // Always use process.env.API_KEY for Gemini API as per guidelines
    const ai = new GoogleGenAI({
      apiKey: process.env.API_KEY
    });

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction:
          context || "أنت مساعد ذكي لنظام إدارة مخازن"
      }
    });

    const result = await chat.sendMessage({ message });

    return new Response(
      JSON.stringify({
        success: true,
        reply: result.text,
        api: "AlMakhazen AI",
        time: Date.now()
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "AI service error"
      }),
      { status: 500 }
    );
  }
};
