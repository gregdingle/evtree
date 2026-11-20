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
  tailwind.configs.recommended,
  {
    // NOTE: added by gregdingle
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // NOTE: same files as the tailwind plugin, which isn't loaded for others
    // like .mjs, so its rules can't be configured there
    files: tailwind.configs.recommended.files,
    rules: {
      "tailwindcss/no-custom-classname": [
        "warn",
        {
          whitelist: [
            // ReactFlow classes
            "nopan",
            "nodrag",
            // EVTree classes, see globals.css
            "evtree",
            "bluelink",
            "collapsed",
            "tooltip",
          ],
        },
      ],
    },
    settings: {
      tailwindcss: {
        // NOTE: required by eslint-plugin-tailwindcss for Tailwind v4
        cssConfigPath: "./src/app/globals.css",
      },
    },
  },
]);

export default eslintConfig;
