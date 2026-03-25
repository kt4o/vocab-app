import express from "express";

export function createTestApp(basePath, router, { useJson = true } = {}) {
  const app = express();
  if (useJson) {
    app.use(express.json());
  }
  app.use(basePath, router);
  return app;
}
