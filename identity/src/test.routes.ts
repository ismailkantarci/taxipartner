import express from "express";

export const testRouter = express.Router();

testRouter.get("/rate", (_req, res) => res.status(429).json({ error: "Rate limited" }));

testRouter.get("/error500", (_req, res) => res.status(500).json({ error: "Internal error" }));

testRouter.get("/slow", async (req, res) => {
  const ms = Number(req.query.delay || 3000);
  await new Promise((resolve) => setTimeout(resolve, ms));
  res.json({ ok: true, delay: ms });
});

testRouter.get("/401", (_req, res) => res.status(401).json({ error: "Unauthorized" }));
