import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  // if you use path aliases, map them here:
  // moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};

export default config;
