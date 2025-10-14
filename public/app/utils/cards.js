(() => {
  window.MusicBee = window.MusicBee || {};
  window.MusicBee.utils = window.MusicBee.utils || {};

  const sortCardsByLastScan = (cardsMap) => {
    return Object.entries(cardsMap)
      .map(([cardId, card]) => ({ ...card, cardId }))
      .sort((a, b) => {
        const usageA = a.usage || {};
        const usageB = b.usage || {};
        const lastScanA = usageA.lastScannedAt
          ? new Date(usageA.lastScannedAt).getTime()
          : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        const lastScanB = usageB.lastScannedAt
          ? new Date(usageB.lastScannedAt).getTime()
          : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        return lastScanB - lastScanA;
      });
  };

  Object.assign(window.MusicBee.utils, {
    sortCardsByLastScan
  });
})();
