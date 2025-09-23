import express from "express";
import { loadConfig, saveConfig } from "../lib/store.js";
import { stopMedia, pauseMedia, resumeMedia, setVolume, getStatus } from "../lib/cast.js";

const router = express.Router();

/**
 * GET /api/v1/player/status
 * Get current player status
 */
router.get("/status", async (_req, res) => {
  try {
    const status = await getStatus();
    return res.json({ ok: true, status });
  } catch (error) {
    return res.json({ 
      ok: false, 
      error: "STATUS_ERROR",
      message: error.message,
      status: { connected: false }
    });
  }
});

/**
 * POST /api/v1/player/stop
 * Stop current playback
 */
router.post("/stop", async (_req, res) => {
  try {
    await stopMedia();
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "STOP_ERROR", 
      message: error.message
    });
  }
});

/**
 * POST /api/v1/player/pause
 * Pause current playback
 */
router.post("/pause", async (_req, res) => {
  try {
    const result = await pauseMedia();
    return res.json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "PAUSE_ERROR",
      message: error.message
    });
  }
});

/**
 * POST /api/v1/player/resume
 * Resume paused playback
 */
router.post("/resume", async (_req, res) => {
  try {
    const result = await resumeMedia();
    return res.json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "RESUME_ERROR", 
      message: error.message
    });
  }
});

/**
 * POST /api/v1/player/volume
 * Set player volume (0.0 - 1.0)
 */
router.post("/volume", async (req, res) => {
  const volume = Number(req.body?.volume);
  
  if (Number.isNaN(volume) || volume < 0 || volume > 1) {
    return res.status(400).json({ 
      ok: false, 
      error: "INVALID_VOLUME",
      message: "Volume must be a number between 0.0 and 1.0"
    });
  }

  try {
    const result = await setVolume(volume);

    // Save volume to config
    const cfg = await loadConfig();
    cfg.player = cfg.player || {};
    cfg.player.volume = volume;
    await saveConfig(cfg);

    return res.json({ ok: true, volume, castResult: result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "VOLUME_ERROR",
      message: error.message
    });
  }
});

export default router;