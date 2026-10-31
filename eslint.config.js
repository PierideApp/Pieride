import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

// eslint-plugin-react n'est pas encore compatible avec ESLint 10, react-hooks suffit pour l'instant
export default defineConfig([
  globalIgnores(["dist", "src-tauri"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  prettierConfig, // Désactive les règles ESLint qui entrent en conflit avec Prettier
  {
    languageOptions: { globals: globals.browser },
    plugins: {
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      "no-duplicate-imports": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "warn",
      "no-unassigned-vars": "error",
      "no-unreachable-loop": "error",
      "no-useless-assignment": "error",
      camelcase: ["error", { properties: "always" }],
      curly: "error",
      "default-case": "error",
      "default-case-last": "error",
      "default-param-last": "error",
      eqeqeq: "error",
      "max-depth": ["error", 4],
      "no-console": "off",
      "no-else-return": "error",
      "no-empty-function": "error",
      "no-extra-label": "error",
      "no-lonely-if": "error",
      "no-unneeded-ternary": "error",
      "no-unused-expressions": "error",
      "no-useless-rename": "error",
      "no-var": "error",
      "no-warning-comments": "warn",
      "prefer-promise-reject-errors": "error",
      "react-hooks/exhaustive-deps": "off",
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
]);
