import "server-only";
import { GoogleGenAI } from "@google/genai";
import { requireEnv } from "./env";

let client: GoogleGenAI | null = null;

/** Each Gemini HTTP call is cancelled after this long, so a slow model cannot hang the chat. */
export const GEMINI_REQUEST_TIMEOUT_MS = 25_000;

export function getGemini(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({
      apiKey: requireEnv("GEMINI_API_KEY"),
      httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS },
    });
  }
  return client;
}
