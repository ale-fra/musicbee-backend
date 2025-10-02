import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { disconnect } from "./lib/cast.js";
import { getLocalIP } from "./lib/network.js";
import { startMDNS, stopMDNS } from "./lib/mdns.js";

// Routes
import uploadRoutes from './routes/upload.js';
import playerRoutes from './routes/player.js';
import cardsRoutes from './routes/cards.js';
import systemRoutes from './routes/system.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const SERVICE_NAME = process.env.MDNS_SERVICE_NAME || "musicbee";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middlewares
app.use(morgan("dev"));
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:8080',
    `http://${SERVICE_NAME}.local`,
    `http://${SERVICE_NAME}.local:${PORT}`,
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^http:\/\/[\w-]+\.local(:\d+)?$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use("/media", express.static(path.join(__dirname, "media"), {
  fallthrough: true,
  setHeaders: (res, path) => {
    res.type(path);
    res.set('Accept-Ranges', 'bytes');
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Serve public folder for static HTML/CSS/JS
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/v1/cards", uploadRoutes);
app.use("/api/v1/cards", cardsRoutes);
app.use("/api/v1/player", playerRoutes);
app.use("/api/v1", systemRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ ok: false, error: "NOT_FOUND" }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    ok: false, 
    error: "INTERNAL_SERVER_ERROR",
    message: err.message 
  });
});

// Start server
app.listen(PORT, "::", () => {
  const localIP = getLocalIP();
  
  console.log(`🎵 MusicBee Backend started:`);
  console.log(`   Local:     http://localhost:${PORT}`);
  console.log(`   Network:   http://${localIP}:${PORT}`);
  
  // Start mDNS
  // startMDNS({ port: PORT, hostname: SERVICE_NAME })
  //   .then(mdnsInfo => {
  //     if (mdnsInfo) {
  //       console.log(`   mDNS:      http://${mdnsInfo.host}:${PORT}`);
  //       console.log(`   API:       http://${mdnsInfo.host}:${PORT}/api/v1`);
  //     }
  //   })
  //   .catch(err => console.warn('[mDNS] Failed to start:', err.message));

  console.log(`\n📱 ESP32 Configuration:`);
  console.log(`   API_BASE_URL="http://${SERVICE_NAME}.local:${PORT}/api/v1"`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  disconnect();
  stopMDNS();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));