import tsParser from "@typescript-eslint/parser";

const baseRestrictedPatterns = [
  {
    group: ["@/server/**"],
    message: "server 层已迁移到 platform 或 modules，请使用新分层路径。",
  },
  {
    group: ["@/features/studio/**", "@/features/settings/models/**"],
    message: "features 旧入口已废弃，请改用 modules/*/presentation。",
  },
  {
    group: [
      "@/hooks/use-studio",
      "@/hooks/use-studio-generate",
      "@/hooks/use-model-config",
      "@/hooks/use-model-health",
      "@/context/StudioContext",
    ],
    message: "请从 modules/*/presentation 下导入对应 hook/context。",
  },
  {
    group: ["@/lib/prompt-builders", "@/lib/simulation", "@/lib/export-book"],
    message: "lib 旧业务文件已迁移，请改用 modules/studio 相关路径。",
  },
];

export default [
  {
    ignores: [".next/**", "node_modules/**"],
    linterOptions: {
      noInlineConfig: true,
    },
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-imports": ["error", { patterns: baseRestrictedPatterns }],
    },
  },
  {
    files: ["src/modules/*/presentation/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/platform/**"],
              message: "presentation 层不得直接依赖 platform 层。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/api/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/platform/ai/strategies/**"],
              message: "app/api 不应直接依赖 strategies，需通过 application/platform contracts 间接访问。",
            },
          ],
        },
      ],
    },
  },
];
