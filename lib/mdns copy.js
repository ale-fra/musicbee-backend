// mdns.js
import mdns from "multicast-dns";
import dgram from "dgram";

let server = null;
let announceTimer = null;

/**
 * Avvia responder mDNS
 */
export async function startMDNS({
  hostname = "musicbee",
  port = 8080,
  interval = 30_000, // ogni 30s ri-annuncia
} = {}) {
  stopMDNS();

  const fqdn = `${hostname}.local`;
  const { ipv4, ipv6 } = await getLocalIPs();

  server = mdns({ reuseAddr: true });

  // Risponde alle query
  server.on("query", (query, rinfo) => {
    for (const q of query.questions || []) {
      const qname = q.name.toLowerCase();

      // Log debug
      console.log(`📡 Query ${q.type} per ${qname} da ${rinfo.address}`);

      // Risposta a A/AAAA
      if (qname === fqdn) {
        if ((q.type === "A" || q.type === "ANY") && ipv4) {
          server.respond({ answers: [{ name: fqdn, type: "A", ttl: 120, data: ipv4 }] });
        }
        if ((q.type === "AAAA" || q.type === "ANY") && ipv6) {
          server.respond({ answers: [{ name: fqdn, type: "AAAA", ttl: 120, data: ipv6 }] });
        }
      }

      // Discovery dei servizi
      if (qname === "_services._dns-sd._udp.local" && q.type === "PTR") {
        server.respond({
          answers: [{ name: "_services._dns-sd._udp.local", type: "PTR", ttl: 120, data: "_http._tcp.local" }],
        });
      }
      if (qname === "_http._tcp.local" && (q.type === "PTR" || q.type === "ANY")) {
        server.respond({
          answers: [{ name: "_http._tcp.local", type: "PTR", ttl: 120, data: `${hostname}._http._tcp.local` }],
        });
      }
    }
  });

  // Annuncio iniziale e periodico
  announce({ fqdn, ipv4, ipv6, port });
  announceTimer = setInterval(() => announce({ fqdn, ipv4, ipv6, port }), interval);

  console.log(`✅ mDNS attivo: ${fqdn} → ${ipv4 || "no IPv4"} ${ipv6 || "no IPv6"}`);
  return { host: fqdn, ipv4, ipv6, port };
}

/**
 * Ferma responder mDNS
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
function announce({ fqdn, ipv4, ipv6, port }) {
  if (!server) return;

  const instance = `musicbee._http._tcp.local`;

  const answers = [];

  if (ipv4) answers.push({ name: fqdn, type: "A", ttl: 120, data: ipv4 });
  if (ipv6) answers.push({ name: fqdn, type: "AAAA", ttl: 120, data: ipv6 });

  // Annuncia anche SRV/TXT per compatibilità Bonjour
  answers.push(
    {
      name: instance,
      type: "SRV",
      ttl: 120,
      data: { port, weight: 0, priority: 0, target: fqdn },
    },
    {
      name: instance,
      type: "TXT",
      ttl: 120,
      data: ["path=/api/v1", "version=1.0"],
    },
    { name: "_http._tcp.local", type: "PTR", ttl: 120, data: instance }
  );

  server.respond({ answers });
//   console.log(`📢 Annuncio: ${fqdn} → ${ipv4 || ""} ${ipv6 || ""}`);
}

/* ---------------- Helpers ---------------- */

/**
 * Restituisce gli IP reali usati dalla LAN (IPv4 + IPv6 se disponibile)
 */
async function getLocalIPs() {
  const [ipv4, ipv6] = await Promise.all([getOutboundIP("udp4"), getOutboundIP("udp6")]);
  return { ipv4, ipv6 };
}

/**
 * Usa un socket UDP per scoprire l’IP effettivo scelto dallo stack
 */
function getOutboundIP(family = "udp4") {
  return new Promise((resolve) => {
    const socket = dgram.createSocket(family);
    const target = family === "udp4" ? "8.8.8.8" : "2001:4860:4860::8888";

    socket.connect(80, target, () => {
      const addr = socket.address().address;
      socket.close();
      resolve(addr);
    });

    socket.on("error", () => resolve(null));
  });
}
