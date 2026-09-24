import reactHooks from "/app/frontend/node_modules/eslint-plugin-react-hooks/index.js";
export default [{
  files: ["**/*.js"],
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { "react-hooks": reactHooks },
  rules: { "react-hooks/exhaustive-deps": "warn", "react-hooks/rules-of-hooks": "error", "no-unused-vars": "warn", "no-undef": "error" },
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } }, globals: { window: "readonly", document: "readonly", console: "readonly", navigator: "readonly", localStorage: "readonly", setTimeout: "readonly", clearTimeout: "readonly", URL: "readonly", Blob: "readonly", Intl: "readonly", process: "readonly", Promise: "readonly", Date: "readonly", Math: "readonly", Number: "readonly", String: "readonly", Array: "readonly", Object: "readonly", JSON: "readonly", Error: "readonly", encodeURIComponent: "readonly", RegExp: "readonly" } },
}];
