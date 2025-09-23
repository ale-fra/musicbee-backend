import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import fse from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

// Simplified schema - only what's actually used
const defaultData = {
  cards: {},
  player: {
    volume: 0.5
  }
};

let db = null;

// Initialize the database
async function initDB() {
  if (db) return db;
  
  await fse.ensureDir(DATA_DIR);
  
  const adapter = new JSONFile(CONFIG_PATH);
  db = new Low(adapter, defaultData);
  
  await db.read();
  
  if (!db.data) {
    db.data = defaultData;
    await db.write();
  }
  
  // Ensure core properties exist
  db.data.cards = db.data.cards || {};
  db.data.player = db.data.player || { volume: 0.5 };
  
  await db.write();
  return db;
}

// Legacy compatibility functions (used by existing code)
export async function loadConfig() {
  const database = await initDB();
  return {
    cards: database.data.cards,
    player: database.data.player
  };
}

export async function saveConfig(cfg) {
  const database = await initDB();
  database.data = { ...database.data, ...cfg };
  await database.write();
  return database.data;
}

// Card management functions (actively used)
export async function getCard(cardId) {
  const database = await initDB();
  return database.data.cards[cardId] || null;
}

export async function setCard(cardId, cardData) {
  const database = await initDB();
  database.data.cards[cardId] = {
    ...cardData,
    id: cardId,
    createdAt: cardData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await database.write();
  return database.data.cards[cardId];
}

export async function deleteCard(cardId) {
  const database = await initDB();
  if (database.data.cards[cardId]) {
    delete database.data.cards[cardId];
    await database.write();
    return true;
  }
  return false;
}

export async function getAllCards() {
  const database = await initDB();
  return Object.entries(database.data.cards).map(([id, card]) => ({
    ...card,
    id
  }));
}

/**
 * Track card usage - increment scan/play counters
 */
export async function trackCardUsage(cardId, isPlayback = false) {
  const database = await initDB();
  
  // Create unknown card if doesn't exist
  if (!database.data.cards[cardId]) {
    database.data.cards[cardId] = {
      type: "unknown",
      title: `Unknown Card ${cardId}`,
      source: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usage: {
        scanCount: 0,
        playCount: 0,
        lastScannedAt: null,
        lastPlayedAt: null
      }
    };
  }

  // Ensure usage object exists
  const usage = ensureCardUsage(database.data.cards[cardId]);
  const now = new Date().toISOString();
  
  if (isPlayback) {
    // Only increment play count and update play timestamp
    usage.playCount++;
    usage.lastPlayedAt = now;
  } else {
    // Only increment scan count and update scan timestamp
    usage.scanCount++;
    usage.lastScannedAt = now;
  }

  // Update card timestamp
  database.data.cards[cardId].updatedAt = now;
  
  await database.write();
  return database.data.cards[cardId];
}

/**
 * Ensure card has usage stats structure
 */
function ensureCardUsage(card) {
  if (!card.usage) {
    card.usage = {
      scanCount: 0,
      playCount: 0,
      lastScannedAt: null,
      lastPlayedAt: null
    };
  }
  return card.usage;
}

/**
 * Get aggregated statistics for all cards
 */
export async function getCardsStatistics() {
  const database = await initDB();
  const cards = database.data.cards || {};
  
  const stats = {
    totalCards: Object.keys(cards).length,
    configuredCards: 0,
    unknownCards: 0,
    totalScans: 0,
    totalPlays: 0,
    mostUsedCard: null,
    recentActivity: []
  };
  
  const cardsList = [];
  
  for (const [cardId, card] of Object.entries(cards)) {
    if (card.type === 'unknown') {
      stats.unknownCards++;
    } else {
      stats.configuredCards++;
    }
    
    const usage = ensureCardUsage(card);
    stats.totalScans += usage.scanCount;
    stats.totalPlays += usage.playCount;
    
    cardsList.push({
      cardId,
      title: card.title,
      type: card.type,
      ...usage
    });
    
    // Add to recent activity if has lastScannedAt
    if (usage.lastScannedAt) {
      stats.recentActivity.push({
        cardId,
        title: card.title,
        type: card.type,
        action: 'scan',
        timestamp: usage.lastScannedAt
      });
    }
    
    if (usage.lastPlayedAt) {
      stats.recentActivity.push({
        cardId,
        title: card.title,
        type: card.type,
        action: 'play',
        timestamp: usage.lastPlayedAt
      });
    }
  }
  
  // Find most used card
  if (cardsList.length > 0) {
    stats.mostUsedCard = cardsList.reduce((prev, current) => 
      (current.scanCount > prev.scanCount) ? current : prev
    );
  }
  
  // Sort recent activity by timestamp (newest first)
  stats.recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  stats.recentActivity = stats.recentActivity.slice(0, 10); // Last 10 activities
  
  return stats;
}

// Utilities
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Export paths for compatibility
export const paths = { DATA_DIR, CONFIG_PATH };

// Export DB instance for advanced usage
export const getDB = initDB;