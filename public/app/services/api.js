import { API_BASE as API_BASE_URL } from '../config.js';

const parseJson = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error('Risposta non valida dal server');
  }
};

const ensureOk = (response, data, fallbackMessage) => {
  if (!response.ok || (data && data.ok === false)) {
    const message = data?.message || fallbackMessage || `Errore ${response.status}`;
    throw new Error(message);
  }
};

export const fetchCardsConfig = async () => {
  const response = await fetch(`${API_BASE_URL}/config`);
  const data = await parseJson(response);
  ensureOk(response, data, 'Impossibile caricare le carte');
  if (!data?.config?.cards) {
    throw new Error('Configurazione carte non disponibile');
  }
  return data.config.cards;
};

export const fetchCardStatistics = async () => {
  const response = await fetch(`${API_BASE_URL}/cards/stats`);
  const data = await parseJson(response);
  ensureOk(response, data, 'Statistiche non disponibili');
  if (!data?.statistics) {
    throw new Error('Statistiche non disponibili');
  }
  return {
    statistics: data.statistics,
    activity: data.statistics.recentActivity || []
  };
};

export const fetchPlayerStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/player/status`);
  const data = await parseJson(response);
  ensureOk(response, data, 'Stato player non disponibile');
  return data.status || {};
};

export const playCardById = async (cardId) => {
  const response = await fetch(`${API_BASE_URL}/cards/${encodeURIComponent(cardId)}/play`, {
    method: 'POST'
  });
  const data = await parseJson(response);
  ensureOk(response, data, 'Errore durante la riproduzione');
  return data.played || {};
};

export const deleteCardById = async (cardId) => {
  const response = await fetch(`${API_BASE_URL}/cards/${encodeURIComponent(cardId)}`, {
    method: 'DELETE'
  });
  const data = await parseJson(response);
  ensureOk(response, data, "Errore durante l'eliminazione");
  return data;
};

export const uploadCardMedia = async ({ cardId, title, file }) => {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('audio', file);

  const response = await fetch(`${API_BASE_URL}/cards/${encodeURIComponent(cardId)}/upload`, {
    method: 'POST',
    body: formData
  });
  const data = await parseJson(response);
  ensureOk(response, data, 'Errore durante la configurazione della carta');
  return data;
};
