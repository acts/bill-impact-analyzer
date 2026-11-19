import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // S-6: untrusted text (bill, AI answer) must never be injected as HTML.
      "react/no-danger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      // S-5: the rubric must never be persisted in the browser.
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "S-5: nothing is persisted." },
        { name: "sessionStorage", message: "S-5: nothing is persisted." },
        { name: "indexedDB", message: "S-5: nothing is persisted." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: "S-5" },
        { object: "window", property: "sessionStorage", message: "S-5" },
        { object: "document", property: "cookie", message: "S-5" },
      ],
    },
  },
  { files: ["tests/**"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
  // e2e reads browser storage only to assert it is empty (S-5 evidence).
  { files: ["e2e/**"], rules: { "no-restricted-properties": "off", "no-restricted-globals": "off" } },
];

export default config;
