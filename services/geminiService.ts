import { GoogleGenAI } from "@google/genai";
import { Invoice } from "../types";

// FIX: Always use direct access to process.env.API_KEY for initialization
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const analyzeInvoiceWithAI = async (invoice: Invoice) => {
  const ai = getAI();
  const prompt = `
    Eres un asistente experto en contabilidad y finanzas para Comercializadora Oni S.A.
    Analiza la siguiente factura y proporciona un resumen ejecutivo en español.
    Incluye: 
    1. Resumen de los artículos adquiridos.
    2. Análisis del impacto fiscal.
    3. Recomendación logística o de inventario.
    
    Factura: ${JSON.stringify(invoice, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // FIX: response.text is a property, not a method
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Lo siento, no pude analizar la factura en este momento.";
  }
};

export const chatWithAI = async (history: {role: string, content: string}[], message: string, invoices: Invoice[]) => {
  const ai = getAI();
  const systemInstruction = `
    Eres el asistente inteligente de Comercializadora Oni S.A. 
    Ayudas a los usuarios a entender sus facturas electrónicas, estados de cuenta y gastos comerciales.
    Facturas actuales del usuario para contexto: ${JSON.stringify(invoices)}
    Responde siempre de forma profesional, clara y amable en español.
  `;

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction,
      }
    });

    const result = await chat.sendMessage({ message });
    // FIX: result.text is a property, not a method
    return result.text;
  } catch (error) {
    console.error("Chat Gemini Error:", error);
    return "Ocurrió un error en la comunicación con la IA.";
  }
};