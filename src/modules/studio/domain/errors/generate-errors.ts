export type GenerateErrorCode = "NO_MODEL_CONFIGURED" | "MODEL_UNAVAILABLE" | "GENERATION_FAILED" | "INVALID_REQUEST";

export type GenerateError = {
  code: GenerateErrorCode;
  message: string;
};

export type GenerateResult<T> = {
  success: boolean;
  data?: T;
  error?: GenerateError;
};

export function noModelError(): GenerateError {
  return { code: "NO_MODEL_CONFIGURED", message: "未配置任何模型，请先在设置中添加模型" };
}

export function generationFailedError(detail: string): GenerateError {
  return { code: "GENERATION_FAILED", message: detail };
}

export function invalidRequestError(detail: string): GenerateError {
  return { code: "INVALID_REQUEST", message: detail };
}
