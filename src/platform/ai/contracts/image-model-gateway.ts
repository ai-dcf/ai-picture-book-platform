import "server-only";

export interface ImageRefInput {
  url: string;
  name?: string;
  type?: 'character' | 'scene';
}

export interface ImageGenerateParams {
  prompt: string;
  negativePrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  seed?: number;
  headers?: Record<string, string>;
  images?: ImageRefInput[];
}

export interface ImageGenerateResult {
  success: boolean;
  imageUrl?: string;
  error?: { code: string; message: string };
}

export interface ImageModelGateway {
  generate(params: ImageGenerateParams): Promise<ImageGenerateResult>;
  generateStream(
    params: ImageGenerateParams,
    onChunk: (chunk: { type: string; imageUrl?: string; progress?: number }) => void
  ): Promise<ImageGenerateResult>;
  health(): Promise<import("./model-health").HealthResult>;
}
