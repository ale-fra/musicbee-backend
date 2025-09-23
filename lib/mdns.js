// mdns.js - Fixed working version
import mdns from "multicast-dns";
import os from "os";

let server = null;
let announceTimer = null;

/**
 * Avvia il responder mDNS per musicbee.local
 */
export async function startMDNS({
  hostname = "musicbee",
  port = 8080,
  interval = 30_000, // ogni 30 secondi
} = {}) {
  stopMDNS();

  const fqdn = `${hostname}.local`;
  const ip4 = getIPv4();
  const ip6 = getIPv6();

//   console.log(`🚀 Starting mDNS: ${fqdn} -> ${ip4}${ip6 ? ` / ${ip6}` : ""}`);

  server = mdns({ 
    reuseAddr: true,
    multicast: true,
    interface: ip4  // Force specific interface
  });

  server.on("error", (err) => {
    console.error(`❌ mDNS Error: ${err.message}`);
  });

  // More aggressive query handling
  server.on("query", (query, rinfo) => {
    // console.log(`📥 Received query from ${rinfo.address}:${rinfo.port}`);
    
    for (const q of query.questions || []) {
    //   console.log(`   Question: ${q.name} (${q.type})`);
      
      if (q.name.toLowerCase() === fqdn.toLowerCase()) {
        if (["A", "ANY"].includes(q.type)) {
        //   console.log(`✅ Responding A record: ${fqdn} -> ${ip4}`);
          server.respond({
            answers: [{ name: fqdn, type: "A", ttl: 120, data: ip4 }]
          }, rinfo);
        }
        if (["AAAA", "ANY"].includes(q.type) && ip6) {
        //   console.log(`✅ Responding AAAA record: ${fqdn} -> ${ip6}`);
          server.respond({
            answers: [{ name: fqdn, type: "AAAA", ttl: 120, data: ip6 }]
          }, rinfo);
        }
      }
      
      // Service discovery
      if (q.name === "_services._dns-sd._udp.local" && q.type === "PTR") {
        server.respond({
          answers: [{ name: "_services._dns-sd._udp.local", type: "PTR", ttl: 120, data: "_http._tcp.local" }],
        }, rinfo);
      }
      
      if (q.name === "_http._tcp.local" && (q.type === "PTR" || q.type === "ANY")) {
        server.respond({
          answers: [{ name: "_http._tcp.local", type: "PTR", ttl: 120, data: `${hostname}._http._tcp.local` }],
        }, rinfo);
      }
    }
  });

  // Immediate and periodic announcements
  const doAnnounce = () => announce({ fqdn, ip4, ip6, port, hostname });
  
  // Initial announcement after small delay
  setTimeout(doAnnounce, 100);
  setTimeout(doAnnounce, 1000);   // Repeat after 1s
  setTimeout(doAnnounce, 5000);   // Repeat after 5s
  
  // Then periodic
  announceTimer = setInterval(doAnnounce, interval);

//   console.log(`✅ mDNS attivo: ${fqdn} → ${ip4}${ip6 ? ` / ${ip6}` : ""}`);
  
  // Return as resolved Promise to maintain compatibility
  return Promise.resolve({ host: fqdn, ipv4: ip4, ipv6: ip6, port });
}

/**
 * Ferma il responder
 */
export function stopMDNS() {
  if (announceTimer) {
    clearInterval(announceTimer);
    announceTimer = null;
  }
  if (server) {
    try {
      server.destroy();
    } catch {}
    server = null;
  }
}

/**
 * Manda un annuncio multicast
 */
function announce({ fqdn, ip4, ip6, port, hostname }) {
  if (!server) return;

  const serviceName = `${hostname}._http._tcp.local`;

  const answers = [
    { name: fqdn, type: "A", ttl: 120, data: ip4 },
    {
      name: serviceName,
      type: "SRV",
      ttl: 120,
      data: { port, weight: 0, priority: 0, target: fqdn },
    },
    {
      name: serviceName,
      type: "TXT",
      ttl: 120,
      data: ["path=/api/v1", "version=1.0"],
    },
    { name: "_http._tcp.local", type: "PTR", ttl: 120, data: serviceName },
  ];

  if (ip6) answers.push({ name: fqdn, type: "AAAA", ttl: 120, data: ip6 });

  server.respond({ answers });
//   console.log(`📢 Annuncio: ${fqdn} → ${ip4}${ip6 ? ` / ${ip6}` : ""}`);
}

/* Helpers */

function getIPv4() {
  const nets = os.networkInterfaces();
  
  // Priority order: 192.168.x.x > 10.x.x.x > others
  const candidates = [];
  
  for (const [name, list] of Object.entries(nets)) {
    for (const i of list) {
      if (
        i.family === "IPv4" &&
        !i.internal &&
        !i.address.startsWith("100.") && // scarta CGNAT/VPN
        !i.address.startsWith("169.254.") // scarta link-local
      ) {
        let priority = 999;
        
        // Prioritize local network ranges
        if (i.address.startsWith("192.168.")) {
          priority = 1; // Highest priority - home networks
        } else if (i.address.startsWith("10.")) {
          priority = 2; // Lower priority - might be VPN/corporate
        } else if (i.address.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)) {
          priority = 3; // Even lower - private range
        }
        
        candidates.push({
          address: i.address,
          interface: name,
          priority: priority
        });
      }
    }
  }
  
  // Sort by priority (lower number = higher priority)
  candidates.sort((a, b) => a.priority - b.priority);
  
  if (candidates.length > 0) {
    // console.log(`✅ Available IPs:`, candidates.map(c => `${c.address} (${c.interface}) pri:${c.priority}`));
    // console.log(`✅ Selected IP: ${candidates[0].address} from ${candidates[0].interface}`);
    return candidates[0].address;
  }
  
  console.warn(`⚠️ No suitable IPv4 found, using localhost`);
  return "127.0.0.1";
}

function getIPv6() {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const i of list) {
      if (i.family === "IPv6" && !i.internal && !i.address.startsWith("fe80:")) {
        return i.address;
      }
    }
  }
  return null;
}