(() => {
  window.MusicBee = window.MusicBee || {};
  window.MusicBee.services = window.MusicBee.services || {};

  const { API_BASE } = window.MusicBee.constants;

  const parseJSON = async (response) => {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      console.warn('[api] Unable to parse JSON response', error);
      return {};
    }
  };

  const request = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await parseJSON(response);
    if (!response.ok) {
      const message = data?.message || `Errore ${response.status}`;
      throw new Error(message);
    }
    return data;
  };

  const fetchCardsConfig = async () => {
    const data = await request('/config');
    if (!data.ok || !data.config || !data.config.cards) {
      throw new Error(data.message || 'Configurazioni carte non disponibili');
    }
    return data.config.cards;
  };

  const fetchCardsStatistics = async () => {
    const data = await request('/cards/stats');
    if (!data.ok || !data.statistics) {
      throw new Error(data.message || 'Statistiche non disponibili');
    }
    return data.statistics;
  };

  const fetchPlayerStatus = async () => {
    const data = await request('/player/status');
    if (!data.ok) {
      throw new Error(data.message || 'Stato player non disponibile');
    }
    return data.status || {};
  };

  const playCard = async (cardId) => {
    const data = await request(`/cards/${encodeURIComponent(cardId)}/play`, {
      method: 'POST'
    });
    if (!data.ok) {
      throw new Error(data.message || 'Errore durante la riproduzione');
    }
    return data;
  };

  const deleteCard = async (cardId) => {
    const data = await request(`/cards/${encodeURIComponent(cardId)}`, {
      method: 'DELETE'
    });
    if (!data.ok) {
      throw new Error(data.message || "Errore durante l'eliminazione");
    }
    return data;
  };

  const uploadCard = async ({ cardId, title, file }) => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('audio', file);

    const data = await request(`/cards/${encodeURIComponent(cardId)}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!data.ok) {
      throw new Error(data.message || 'Errore durante la configurazione della carta');
    }

    return data;
  };

  Object.assign(window.MusicBee.services, {
    fetchCardsConfig,
    fetchCardsStatistics,
    fetchPlayerStatus,
    playCard,
    deleteCard,
    uploadCard
  });
})();
