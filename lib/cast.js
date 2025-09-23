import dotenv from "dotenv";
import { Client, DefaultMediaReceiver } from 'castv2-client';
import mdns from 'multicast-dns';
import { getLocalIP } from "./network.js";

dotenv.config();

let castClient = null;
let castPlayer = null;
let isConnected = false;
let discoveredDevices = new Map();

// Stato interno per tracking
let current = {
  isPlaying: false,
  isPaused: false,
  title: null,
  src: null,
  startedAt: null,
  volume: 0.5,
  duration: null,
  currentTime: 0
};

/**
 * Auto-discovery di dispositivi Chromecast sulla rete usando multicast-dns
 */
function startDeviceDiscovery(targetName = null) {
  return new Promise((resolve, reject) => {
    const mdnsClient = mdns();
    const foundDevices = new Map();
    
    const timeout = setTimeout(() => {
      mdnsClient.destroy();
      if (targetName) {
        reject(new Error(`Google Cast device "${targetName}" not found`));
      } else {
        reject(new Error('No Google Cast devices found'));
      }
    }, 10000); // 10 secondi timeout

    // Query per servizi Chromecast
    mdnsClient.query({
      questions: [{
        name: '_googlecast._tcp.local',
        type: 'PTR'
      }]
    });

    mdnsClient.on('response', (response) => {
      response.answers.forEach((answer) => {
        if (answer.type === 'PTR' && answer.name === '_googlecast._tcp.local') {
          // Trovato un servizio Chromecast, ora cerchiamo i dettagli
          const serviceName = answer.data;
          
          // Query per record SRV e TXT
          mdnsClient.query({
            questions: [
              { name: serviceName, type: 'SRV' },
              { name: serviceName, type: 'TXT' }
            ]
          });
        }
        
        if (answer.type === 'SRV') {
          const deviceHost = answer.data.target;
          const devicePort = answer.data.port;
          const serviceName = answer.name;
          
          // Cerca record A per ottenere l'IP
          mdnsClient.query({
            questions: [{ name: deviceHost, type: 'A' }]
          });
          
          foundDevices.set(serviceName, {
            host: deviceHost,
            port: devicePort,
            serviceName: serviceName
          });
        }
        
        if (answer.type === 'TXT') {
          const serviceName = answer.name;
          const txtData = answer.data;
          
          // Parsing dei dati TXT per ottenere il nome del device
          let deviceName = serviceName;
          if (Array.isArray(txtData)) {
            txtData.forEach(item => {
              const str = item.toString();
              if (str.startsWith('fn=')) {
                deviceName = str.substring(3);
              }
            });
          }
          
          const device = foundDevices.get(serviceName);
          if (device) {
            device.name = deviceName;
            foundDevices.set(serviceName, device);
          }
        }
        
        if (answer.type === 'A') {
          const hostname = answer.name;
          const ip = answer.data;
          
          // Trova il device che corrisponde a questo hostname
          foundDevices.forEach((device, serviceName) => {
            if (device.host === hostname && !device.ip) {
              device.ip = ip;
              device.name = device.name || hostname.split('.')[0];
              
              discoveredDevices.set(device.name, {
                name: device.name,
                host: ip,
                port: device.port,
                serviceName: serviceName
              });

              console.log(`[CAST] Discovered: ${device.name} at ${ip}:${device.port}`);

              // Controllo se questo è il device che stiamo cercando
              if (targetName && device.name.toLowerCase().includes(targetName.toLowerCase())) {
                clearTimeout(timeout);
                mdnsClient.destroy();
                resolve({ host: ip, port: device.port, name: device.name });
                return;
              }

              // Se non specifico, prendi il primo trovato
              if (!targetName) {
                clearTimeout(timeout);
                mdnsClient.destroy();
                resolve({ host: ip, port: device.port, name: device.name });
                return;
              }
            }
          });
        }
      });
    });

    mdnsClient.on('error', (err) => {
      clearTimeout(timeout);
      mdnsClient.destroy();
      reject(err);
    });
  });
}

/**
 * Connessione al dispositivo Cast
 */
async function connectToCastDevice(deviceInfo) {
  return new Promise((resolve, reject) => {
    castClient = new Client();
    
    castClient.connect(deviceInfo.host, () => {
      console.log(`[CAST] Connected to ${deviceInfo.name} (${deviceInfo.host})`);
      
      castClient.launch(DefaultMediaReceiver, (err, player) => {
        if (err) {
          console.error('[CAST] Error launching media receiver:', err);
          reject(err);
          return;
        }

        castPlayer = player;
        isConnected = true;

        // Listener per aggiornamenti stato
        player.on('status', (status) => {
          updateCurrentStatus(status);
        });

        resolve(player);
      });
    });

    castClient.on('error', (err) => {
      console.error('[CAST] Connection error:', err);
      isConnected = false;
      reject(err);
    });

    castClient.on('disconnect', () => {
      console.log('[CAST] Disconnected');
      isConnected = false;
      castClient = null;
      castPlayer = null;
    });
  });
}

/**
 * Aggiorna stato interno basato su status del Cast
 */
function updateCurrentStatus(status) {
  if (status && status.media) {
    current.isPlaying = status.playerState === 'PLAYING';
    current.isPaused = status.playerState === 'PAUSED';
    current.currentTime = status.currentTime || 0;
    current.duration = status.media.duration || null;
    current.volume = status.volume?.level || current.volume;
    
    // Aggiorna titolo se disponibile nei metadata
    if (status.media.metadata?.title) {
      current.title = status.media.metadata.title;
    }
  } else {
    // Nessun media in riproduzione
    current.isPlaying = false;
    current.isPaused = false;
    current.currentTime = 0;
  }
}

/**
 * Assicura connessione attiva al Cast
 */
async function ensureConnection() {
  if (isConnected && castPlayer) {
    return castPlayer;
  }

  const targetDeviceName = process.env.CAST_DEVICE_NAME || null;
  
  try {
    console.log(`[CAST] Discovering Cast devices${targetDeviceName ? ` (looking for: ${targetDeviceName})` : ''}...`);
    const deviceInfo = await startDeviceDiscovery(targetDeviceName);
    
    console.log(`[CAST] Connecting to ${deviceInfo.name}...`);
    const player = await connectToCastDevice(deviceInfo);
    
    return player;
  } catch (error) {
    throw new Error(`Failed to connect to Cast device: ${error.message}`);
  }
}

/**
 * Riproduce media sul Cast device
 */
export async function playMedia({ title, src, volume }) {
  try {
    const player = await ensureConnection();

    // Fix hostname: sostituisci .local con IP reale se necessario
    let resolvedSrc = src;
    if (src.includes('.local')) {
      const localIP = getLocalIP();
      resolvedSrc = src.replace(/https?:\/\/[^.]+\.local(:\d+)?/, `http://${localIP}${src.match(/:(\d+)/) ? ':' + src.match(/:(\d+)/)[1] : ''}`);
      console.log(`[CAST] Resolved hostname: ${src} -> ${resolvedSrc}`);
    }

    const mediaObject = {
      contentId: resolvedSrc,
      contentType: resolvedSrc.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mpeg',
      streamType: 'BUFFERED',
      metadata: {
        type: 3, // MUSIC_TRACK invece di 0 (GENERIC)
        metadataType: 3, // MUSIC_TRACK invece di 0 (GENERIC)
        title: title || "Unknown Track",
        artist: "MusicBee Player", // Ora valido con metadataType: 3
        album:""
      }
    };

    return new Promise((resolve, reject) => {
      player.load(mediaObject, { autoplay: true }, (err, status) => {
        if (err) {
          console.error('[CAST] Error loading media:', err);
          reject(new Error(`Failed to load media: ${err.message}`));
          return;
        }

        // Aggiorna stato locale
        current.title = title || "Unknown Track";
        current.src = resolvedSrc; // Usa l'URL risolto
        current.startedAt = new Date().toISOString();
        current.isPlaying = true;
        current.isPaused = false;

        // Imposta volume se specificato
        if (typeof volume === 'number') {
          setVolume(volume).catch(console.error);
        }

        console.log(`[CAST] Playing: "${current.title}" from ${resolvedSrc}`);
        resolve({ ok: true, status: status });
      });
    });

  } catch (error) {
    console.error('[CAST] playMedia error:', error);
    throw error;
  }
}

/**
 * Ferma la riproduzione
 */
export async function stopMedia() {
  try {
    const player = await ensureConnection();

    return new Promise((resolve, reject) => {
      player.stop((err, status) => {
        if (err) {
          console.error('[CAST] Error stopping media:', err);
          reject(new Error(`Failed to stop media: ${err.message}`));
          return;
        }

        current.isPlaying = false;
        current.isPaused = false;
        current.currentTime = 0;
        
        console.log('[CAST] Stopped');
        resolve({ ok: true, status: status });
      });
    });

  } catch (error) {
    console.error('[CAST] stopMedia error:', error);
    throw error;
  }
}

/**
 * Pausa la riproduzione
 */
export async function pauseMedia() {
  try {
    const player = await ensureConnection();

    return new Promise((resolve, reject) => {
      player.pause((err, status) => {
        if (err) {
          console.error('[CAST] Error pausing media:', err);
          reject(new Error(`Failed to pause media: ${err.message}`));
          return;
        }

        current.isPlaying = false;
        current.isPaused = true;
        
        console.log('[CAST] Paused');
        resolve({ ok: true, status: status });
      });
    });

  } catch (error) {
    console.error('[CAST] pauseMedia error:', error);
    throw error;
  }
}

/**
 * Riprende la riproduzione
 */
export async function resumeMedia() {
  try {
    const player = await ensureConnection();

    return new Promise((resolve, reject) => {
      player.play((err, status) => {
        if (err) {
          console.error('[CAST] Error resuming media:', err);
          reject(new Error(`Failed to resume media: ${err.message}`));
          return;
        }

        current.isPlaying = true;
        current.isPaused = false;
        
        console.log('[CAST] Resumed');
        resolve({ ok: true, status: status });
      });
    });

  } catch (error) {
    console.error('[CAST] resumeMedia error:', error);
    throw error;
  }
}

/**
 * Imposta il volume (0.0 - 1.0)
 */
export async function setVolume(volume) {
  try {
    // Assicurati che sia connesso
    await ensureConnection();
    
    const normalizedVolume = Math.max(0, Math.min(1, volume));

    return new Promise((resolve, reject) => {
      // Usa castClient.setVolume invece di player.setVolume
      castClient.setVolume({ level: normalizedVolume }, (err, volume) => {
        if (err) {
          console.error('[CAST] Error setting volume:', err);
          reject(new Error(`Failed to set volume: ${err.message}`));
          return;
        }

        current.volume = normalizedVolume;
        
        console.log(`[CAST] Volume set to ${Math.round(normalizedVolume * 100)}%`);
        resolve({ ok: true, volume: normalizedVolume, castVolume: volume });
      });
    });

  } catch (error) {
    console.error('[CAST] setVolume error:', error);
    throw error;
  }
}

/**
 * Ottiene lo stato attuale del player
 */
export async function getStatus() {
  try {
    if (!isConnected || !castPlayer) {
      return {
        ...current,
        connected: false,
        error: 'Not connected to Cast device'
      };
    }

    return new Promise((resolve, reject) => {
      castPlayer.getStatus((err, status) => {
        if (err) {
          console.error('[CAST] Error getting status:', err);
          resolve({
            ...current,
            connected: false,
            error: err.message
          });
          return;
        }

        // Aggiorna stato con dati reali
        updateCurrentStatus(status);
        
        resolve({
          ...current,
          connected: true,
          castStatus: status
        });
      });
    });

  } catch (error) {
    console.error('[CAST] getStatus error:', error);
    return {
      ...current,
      connected: false,
      error: error.message
    };
  }
}

/**
 * Disconnette dal dispositivo Cast
 */
export function disconnect() {
  if (castClient) {
    castClient.close();
    castClient = null;
    castPlayer = null;
    isConnected = false;
    console.log('[CAST] Disconnected manually');
  }
}

/**
 * Lista dispositivi Cast scoperti
 */
export function getDiscoveredDevices() {
  return Array.from(discoveredDevices.values());
}