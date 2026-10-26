import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: ["life-sim.spec.ts"],
  use: {
    ...base.use,
    ...devices["iPhone 13"],
    browserName: "webkit",
    channel: undefined,
    serviceWorkers: "block",
  },
});
