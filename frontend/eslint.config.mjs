import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    // Generated API client and build/test output
    ignores: [".next/**", "out/**", "node_modules/**", "src/api/**", "test-results/**", "playwright-report/**"],
  },
];

export default eslintConfig;
