import "server-only";

export interface TextGenerateParams {
  prompt: string;
  systemPrompt?: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
}

export interface TextGenerateResult {
  success: boolean;
  text?: string;
  error?: { code: string; message: string };
}

export interface TextStreamChunk {
  type: "delta" | "done" | "error";
  text?: string;
  result?: TextGenerateResult;
  error?: { message: string };
}

export interface TextModelGateway {
  generate(params: TextGenerateParams): Promise<TextGenerateResult>;
  generateStream(
    params: TextGenerateParams,
    onChunk: (chunk: TextStreamChunk) => void
  ): Promise<TextGenerateResult>;
  health(): Promise<import("./model-health").HealthResult>;
}
