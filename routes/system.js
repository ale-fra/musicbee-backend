import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig } from "../lib/store.js";
import { getLocalIP } from "../lib/network.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));


/**
 * GET /api/v1/config
 * Get full system configuration
 */
router.get("/config", async (_req, res) => {
  try {
    const cfg = await loadConfig();
    res.json({ ok: true, config: cfg });
  } catch (error) {
    console.error('[SYSTEM] Config error:', error);
    res.status(500).json({
      ok: false,
      error: "CONFIG_ERROR",
      message: error.message
    });
  }
});

/**
 * GET /healthz
 * Health check endpoint
 */
router.get("/healthz", (_req, res) => {
  const localIP = getLocalIP();
  const SERVICE_NAME = process.env.MDNS_SERVICE_NAME || "musicbee";
  const PORT = process.env.PORT || 8080;
  const mdnsUrl = `http://${SERVICE_NAME}.local:${PORT}`;
  
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    service: "musicbee-backend",
    version: "0.1.0",
    network: {
      localIP: localIP,
      port: PORT,
      mdns: {
        hostname: `${SERVICE_NAME}.local`,
        url: mdnsUrl
      }
    }
  });
});

export default router;