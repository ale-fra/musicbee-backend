// routes/upload.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { loadConfig, saveConfig } from '../lib/store.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configurazione multer per upload files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mediaDir = path.resolve(__dirname, "..", "media");
    fs.ensureDirSync(mediaDir); // Assicura che la cartella esista
    cb(null, mediaDir);
  },
  filename: (req, file, cb) => {
    // Genera nome file pulito dal titolo o usa originale
    const { title } = req.body;
    let filename;
    
    if (title) {
      // Converte titolo in nome file sicuro
      filename = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Rimuove caratteri speciali
        .replace(/\s+/g, '-') // Spazi -> trattini
        .replace(/-+/g, '-') // Multipli trattini -> singolo
        .trim('-'); // Rimuove trattini iniziali/finali
      
      filename = filename + path.extname(file.originalname);
    } else {
      // Fallback al nome originale
      filename = file.originalname;
    }
    
    cb(null, filename);
  }
});

// Filtro per accettare solo audio
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'audio/mpeg',
    'audio/mp3', 
    'audio/wav',
    'audio/ogg',
    'audio/m4a'
  ];
  
  const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Formato non supportato. Usa: ${allowedExts.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 1 // Solo un file per volta
  }
});

// POST /api/v1/cards/:cardId/upload
router.post("/:cardId/upload", upload.single('audio'), async (req, res) => {
  const { cardId } = req.params;
  const { title, type = 'track' } = req.body;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "MISSING_FILE",
        message: "Nessun file audio caricato"
      });
    }

    if (!title || title.trim() === '') {
      // Cleanup file se validazione fallisce
      await fs.remove(req.file.path);
      return res.status(400).json({
        ok: false,
        error: "MISSING_TITLE", 
        message: "Titolo obbligatorio"
      });
    }

    // Percorso relativo per la configurazione
    const relativePath = `/media/${req.file.filename}`;
    
    // Aggiorna configurazione
    const cfg = await loadConfig();
    cfg.cards = cfg.cards || {};
    cfg.cards[cardId] = {
      type: type,
      title: title.trim(),
      source: relativePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await saveConfig(cfg);

    console.log(`[UPLOAD] Card ${cardId}: "${title}" -> ${relativePath}`);

    return res.json({
      ok: true,
      cardId: cardId,
      uploaded: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: relativePath,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      card: cfg.cards[cardId]
    });

  } catch (error) {
    // Cleanup file se qualcosa va storto
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    console.error('Upload error:', error);
    return res.status(500).json({
      ok: false,
      error: "UPLOAD_ERROR",
      message: error.message
    });
  }
});

// PUT /api/v1/cards/:cardId/config - Solo configurazione senza upload
router.put("/:cardId/config", async (req, res) => {
  const { cardId } = req.params;
  const { type, title, source } = req.body;

  if (!title || !source) {
    return res.status(400).json({
      ok: false,
      error: "MISSING_FIELDS",
      message: "Titolo e source sono obbligatori"
    });
  }

  try {
    const cfg = await loadConfig();
    cfg.cards = cfg.cards || {};
    cfg.cards[cardId] = {
      type: type || 'track',
      title: title.trim(),
      source: source.trim(),
      createdAt: cfg.cards[cardId]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await saveConfig(cfg);

    console.log(`[CONFIG] Card ${cardId}: "${title}" -> ${source}`);

    return res.json({
      ok: true,
      cardId: cardId,
      card: cfg.cards[cardId]
    });

  } catch (error) {
    console.error('Config error:', error);
    return res.status(500).json({
      ok: false,
      error: "CONFIG_ERROR",
      message: error.message
    });
  }
});

// DELETE /api/v1/cards/:cardId
router.delete("/:cardId", async (req, res) => {
  const { cardId } = req.params;
  
  try {
    const cfg = await loadConfig();
    const card = cfg.cards?.[cardId];
    
    if (!card) {
      return res.status(404).json({
        ok: false,
        error: "CARD_NOT_FOUND",
        message: `Carta ${cardId} non trovata`
      });
    }

    // Rimuovi file se locale
    if (card.source && card.source.startsWith('/media/')) {
      const filePath = path.resolve(__dirname, "..", card.source.replace('/media/', 'media/'));
      try {
        await fs.remove(filePath);
        console.log(`[DELETE] Removed file: ${filePath}`);
      } catch (fileError) {
        console.warn(`[DELETE] Could not remove file ${filePath}:`, fileError.message);
      }
    }

    // Rimuovi dalla configurazione
    delete cfg.cards[cardId];
    await saveConfig(cfg);

    console.log(`[DELETE] Card ${cardId} removed`);

    return res.json({
      ok: true,
      cardId: cardId,
      message: "Carta eliminata con successo"
    });

  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({
      ok: false,
      error: "DELETE_ERROR",
      message: error.message
    });
  }
});

// GET /api/v1/cards/:cardId - Info singola carta
router.get("/:cardId", async (req, res) => {
  const { cardId } = req.params;
  
  try {
    const cfg = await loadConfig();
    const card = cfg.cards?.[cardId];
    
    if (!card) {
      return res.status(404).json({
        ok: false,
        error: "CARD_NOT_FOUND",
        message: `Carta ${cardId} non trovata`
      });
    }

    return res.json({
      ok: true,
      cardId: cardId,
      card: card
    });

  } catch (error) {
    console.error('Get card error:', error);
    return res.status(500).json({
      ok: false,
      error: "GET_ERROR",
      message: error.message
    });
  }
});

// GET /api/v1/cards - Lista tutte le carte
router.get("/", async (req, res) => {
  try {
    const cfg = await loadConfig();
    const cards = cfg.cards || {};
    
    // Converti in array con cardId incluso
    const cardsArray = Object.entries(cards).map(([cardId, card]) => ({
      cardId,
      ...card
    }));

    return res.json({
      ok: true,
      count: cardsArray.length,
      cards: cardsArray
    });

  } catch (error) {
    console.error('List cards error:', error);
    return res.status(500).json({
      ok: false,
      error: "LIST_ERROR",
      message: error.message
    });
  }
});

// Error handler per multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        ok: false,
        error: "FILE_TOO_LARGE",
        message: "File troppo grande (max 50MB)"
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        ok: false,
        error: "TOO_MANY_FILES", 
        message: "Carica un solo file per volta"
      });
    }
  }
  
  if (error.message.includes('Formato non supportato')) {
    return res.status(400).json({
      ok: false,
      error: "UNSUPPORTED_FORMAT",
      message: error.message
    });
  }

  next(error);
});

export default router;