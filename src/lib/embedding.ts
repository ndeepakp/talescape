import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const MODEL = "Xenova/all-MiniLM-L6-v2";

// Load the model once and reuse it (loading is slow; inference is fast).
const globalForModel = globalThis as unknown as {
  extractor?: Promise<FeatureExtractionPipeline>;
};

function getExtractor() {
  globalForModel.extractor ??= pipeline("feature-extraction", MODEL);
  return globalForModel.extractor;
}

/** Turn text into a 384-dimension, unit-length embedding vector. */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/** pgvector literal, e.g. "[0.1,0.2,0.3]". */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
