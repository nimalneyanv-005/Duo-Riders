import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

// Gemini embeddings, shortened to 1536 dims so they fit the existing vector(1536) columns
const model = google.textEmbeddingModel("gemini-embedding-001");
const options = { google: { outputDimensionality: 1536 } };

export async function embedText(value: string) {
  const { embedding } = await embed({ model, value, providerOptions: options });
  return embedding;
}

export async function embedTexts(values: string[]) {
  const { embeddings } = await embedMany({
    model,
    values,
    providerOptions: options,
  });
  return embeddings;
}

export const toVector = (e: number[]) => JSON.stringify(e);
