import type { FeatureExtractionPipeline } from '@huggingface/transformers';

let _pipe: FeatureExtractionPipeline | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!_pipe) {
    const { pipeline } = await import('@huggingface/transformers');
    _pipe = (await pipeline(
      'feature-extraction',
      process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2',
    )) as FeatureExtractionPipeline;
  }
  return _pipe;
}

export async function embed(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}
