import express from "express";
import { loadConfig, trackCardUsage, getCardsStatistics } from "../lib/store.js";
import { playMedia, stopMedia, pauseMedia, resumeMedia } from "../lib/cast.js";

const router = express.Router();
const SERVICE_NAME = process.env.MDNS_SERVICE_NAME || "musicbee";

/**
 * ESP32 -> POST /api/v1/cards/:cardId/play
 * Main endpoint for card interactions
 */
router.post("/:cardId/play", async (req, res) => {
  const { cardId } = req.params;
  const { sourceOverride, action = "play" } = req.body || {};

  try {
    const cfg = await loadConfig();
    const card = cfg.cards?.[cardId];

    // Handle control actions (no tracking needed for these)
    if (action === "stop") {
      await stopMedia();
      return res.json({ ok: true, action: "stop" });
    }

    if (action === "pause") {
      await pauseMedia();
      return res.json({ ok: true, action: "pause" });
    }

    if (action === "resume") {
      await resumeMedia();
      return res.json({ ok: true, action: "resume" });
    }

    // For actual playback, track scan first
    await trackCardUsage(cardId, false);

    // Check if card is configured
    if (!sourceOverride && (!card || card.type === "unknown")) {
      return res.status(404).json({
        ok: false,
        error: "CARD_NOT_CONFIGURED",
        message: `Card ${cardId} not configured`,
        cardInfo: {
          cardId,
          isKnown: !!card,
          type: card?.type || 'unknown',
          usage: card?.usage || null
        }
      });
    }

    // Prepare entry for playback
    const entry = sourceOverride
      ? { type: "url", title: `Card ${cardId}`, source: sourceOverride }
      : card;

    // Normalize URL using mDNS if available
    let src = entry.source;
    if (entry.type === "track" && !/^https?:\/\//.test(src)) {
      const base = process.env.PUBLIC_BASE_URL || `http://${SERVICE_NAME}.local:${process.env.PORT || 8080}`;
      src = `${base}${src.startsWith("/") ? "" : "/"}${src}`;
    }

    const vol = cfg.player?.volume ?? 0.5;

    // Attempt playback
    const result = await playMedia({ title: entry.title, src, volume: vol });

    // Track successful playback (this will increment ONLY play count, not scan)
    const updatedCard = await trackCardUsage(cardId, true);
    
    console.log(`[PLAY] Card ${cardId}: "${entry.title}" (scan #${updatedCard.usage?.scanCount || 1}, play #${updatedCard.usage?.playCount || 1})`);

    return res.json({
      ok: true,
      played: { cardId, title: entry.title, src },
      volume: vol,
      castResult: result,
      tracking: {
        scanCount: updatedCard.usage?.scanCount || 1,
        playCount: updatedCard.usage?.playCount || 1,
        lastPlayedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[CARDS] Play error:', error);
    
    return res.status(500).json({
      ok: false,
      error: "CAST_ERROR",
      message: error.message,
      cardInfo: {
        cardId,
        wasScanned: true,
        playbackFailed: true
      }
    });
  }
});

/**
 * POST /api/v1/cards/:cardId/scan
 * Scan card without playback (for tracking only)
 */
router.post("/:cardId/scan", async (req, res) => {
  const { cardId } = req.params;
  
  try {
    const cardData = await trackCardUsage(cardId, false);
    
    console.log(`[SCAN] Card ${cardId} scanned (total scans: ${cardData.usage.scanCount})`);
    
    return res.json({
      ok: true,
      cardId,
      card: cardData,
      message: cardData.type === 'unknown' 
        ? 'Card not configured but tracked'
        : 'Card scanned'
    });
    
  } catch (error) {
    console.error('[CARDS] Scan error:', error);
    return res.status(500).json({
      ok: false,
      error: "SCAN_ERROR",
      message: error.message
    });
  }
});

/**
 * GET /api/v1/cards/stats
 * Get aggregated statistics for all cards
 */
router.get("/stats", async (_req, res) => {
  try {
    const stats = await getCardsStatistics();
    return res.json({
      ok: true,
      statistics: stats
    });
  } catch (error) {
    console.error('[CARDS] Stats error:', error);
    return res.status(500).json({
      ok: false,
      error: "STATS_ERROR",
      message: error.message
    });
  }
});

export default router;