import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";
import { defineConfig } from "eslint/config";

const eslintConfig = defineConfig([
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  ...tailwind.configs["flat/recommended"],
  {
    // NOTE: added by gregdingle
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
    settings: {
      tailwindcss: {
        // Disable config file requirement for Tailwind v4
        config: false,
        whitelist: [
          // ReactFlow classes
          "nopan",
          "nodrag",
          // EVTree classes
          "evtree",
        ],
      },
    },
  },
]);

export default eslintConfig;
