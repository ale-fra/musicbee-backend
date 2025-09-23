import os from "os";

/**
 * Ottiene l'IP locale della macchina sulla rete, prioritizzando le reti locali
 */
export function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  // Lista delle interfacce da escludere (VPN, virtuali, etc.)
  const excludeInterfaces = [
    'docker', 'vmware', 'virtualbox', 'hyper-v', 'vethernet', 
    'tun', 'tap', 'vpn', 'wsl', 'vboxnet', 'vmnet'
  ];
  
  // Range IP delle reti locali (in ordine di priorità)
  const localRanges = [
    { range: /^192\.168\./, priority: 1 },  // Rete domestica comune
    { range: /^10\./, priority: 2 },        // Rete aziendale
    { range: /^172\.(1[6-9]|2\d|3[01])\./, priority: 3 } // Rete privata
  ];
  
  const candidates = [];
  
  // Raccoglie tutti gli IP candidati con priorità
  for (const [name, ifaces] of Object.entries(interfaces)) {
    // Salta interfacce virtuali/VPN
    const nameCheck = name.toLowerCase();
    if (excludeInterfaces.some(exclude => nameCheck.includes(exclude))) {
      continue;
    }
    
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Determina priorità basata sul range IP
        let priority = 999; // Default per IP non locali
        let isLocal = false;
        
        for (const localRange of localRanges) {
          if (localRange.range.test(iface.address)) {
            priority = localRange.priority;
            isLocal = true;
            break;
          }
        }
        
        // Priorità bonus per interfacce WiFi/Ethernet comuni
        const interfaceBonuses = {
          'wi-fi': -0.1,
          'wifi': -0.1,
          'wlan': -0.1,
          'ethernet': -0.2,
          'eth0': -0.3,
          'wlan0': -0.3
        };
        
        for (const [keyword, bonus] of Object.entries(interfaceBonuses)) {
          if (nameCheck.includes(keyword)) {
            priority += bonus;
            break;
          }
        }
        
        candidates.push({
          address: iface.address,
          interface: name,
          priority: priority,
          isLocal: isLocal
        });
      }
    }
  }
  
  // Ordina per priorità (priorità più bassa = migliore)
  candidates.sort((a, b) => a.priority - b.priority);
  
  // Debug logging
  if (candidates.length > 1) {
    console.log('[NETWORK] Available IPs:');
    candidates.forEach(c => 
      console.log(`  ${c.address} (${c.interface}) priority:${c.priority} local:${c.isLocal}`)
    );
  }
  
  // Restituisci il migliore, fallback su localhost
  const best = candidates[0];
  if (best) {
    console.log(`[NETWORK] Selected IP: ${best.address} from ${best.interface}`);
    return best.address;
  }
  
  console.warn('[NETWORK] No suitable local IP found, using localhost');
  return 'localhost';
}

/**
 * Ottiene tutte le interfacce di rete disponibili
 */
export function getAllNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const result = {};
  
  for (const [name, ifaces] of Object.entries(interfaces)) {
    result[name] = ifaces
      .filter(iface => iface.family === 'IPv4')
      .map(iface => ({
        address: iface.address,
        internal: iface.internal,
        mac: iface.mac
      }));
  }
  
  return result;
}

/**
 * Verifica se un IP è nella rete locale
 */
export function isLocalNetworkIP(ip) {
  const localRanges = [
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^127\./,
    /^169\.254\./
  ];
  
  return localRanges.some(range => range.test(ip));
}

/**
 * Genera gli URL base per i diversi servizi
 */
export function generateServiceUrls(ip, port) {
  const base = `http://${ip}:${port}`;
  return {
    base,
    api: `${base}/api/v1`,
    media: `${base}/media`,
    health: `${base}/healthz`,
    info: `${base}/api/v1/info`
  };
}