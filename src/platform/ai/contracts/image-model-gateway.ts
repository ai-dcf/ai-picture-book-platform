import "server-only";

export interface ImageGenerateParams {
  prompt: string;
  negativePrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  seed?: number;
  headers?: Record<string, string>;
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
