import type { Linter } from "eslint";
import nextPlugin from "@next/eslint-plugin-next";

const eslintConfig: Linter.Config[] = [
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**"],
  },
];

export default eslintConfig;
