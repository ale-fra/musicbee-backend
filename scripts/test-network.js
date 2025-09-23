#!/usr/bin/env node

import { getLocalIP, getAllNetworkInterfaces, generateServiceUrls } from "../lib/network.js";

console.log("🔍 Network Discovery per musicbee Backend\n");

// IP locale
const localIP = getLocalIP();
console.log(`📍 IP Locale rilevato: ${localIP}`);

// Tutte le interfacce
const interfaces = getAllNetworkInterfaces();
console.log("\n🌐 Interfacce di rete disponibili:");
for (const [name, ifaces] of Object.entries(interfaces)) {
  ifaces.forEach(iface => {
    const type = iface.internal ? "(locale)" : "(rete)";
    console.log(`   ${name}: ${iface.address} ${type}`);
  });
}

// URL di servizio
const port = process.env.PORT || 8080;
const urls = generateServiceUrls(localIP, port);

console.log(`\n🚀 URL del servizio (porta ${port}):`);
console.log(`   Base URL: ${urls.base}`);
console.log(`   API:      ${urls.api}`);
console.log(`   Media:    ${urls.media}`);
console.log(`   Health:   ${urls.health}`);

console.log(`\n📱 Test con ESP32:`);
console.log(`   curl -X POST ${urls.api}/cards/TEST123/play`);

console.log(`\n🎵 Test streaming audio:`);
console.log(`   ${urls.media}/esempio.mp3`);

console.log(`\n📋 Test da altri dispositivi sulla rete:`);
console.log(`   Smartphone: apri ${urls.health} nel browser`);
console.log(`   PC:         curl ${urls.health}`);

// Test di connettività (opzionale)
console.log("\n🧪 Eseguendo test di base...");

try {
  const response = await fetch(`http://localhost:${port}/healthz`);
  if (response.ok) {
    console.log("✅ Server locale raggiungibile");
    const data = await response.json();
    console.log(`   Timestamp: ${data.timestamp}`);
  }
} catch (error) {
  console.log("❌ Server locale non raggiungibile");
  console.log("   Assicurati che il server sia avviato");
}