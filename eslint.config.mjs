import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [{
  ignores: [".next/**"],
}, ...nextCoreWebVitals, ...nextTypescript, ...tailwind.configs["flat/recommended"], {
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
}];

export default eslintConfig;
