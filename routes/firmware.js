import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "..", "data", "firmware-manifest.json");

router.get("/manifest.json", async (_req, res) => {
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    return res.json(manifest);
  } catch (error) {
    console.error("Failed to load firmware manifest", error);
    return res.status(500).json({
      ok: false,
      error: "FIRMWARE_MANIFEST_LOAD_ERROR",
      message: "Unable to load firmware manifest"
    });
  }
});

export default router;
