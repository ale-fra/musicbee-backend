(() => {
  window.MusicBee = window.MusicBee || {};

  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const { constants, hooks, components, services, utils } = window.MusicBee;
  const { API_BASE, statusBadgeClasses } = constants;
  const { useToast } = hooks;
  const { Toast, StatCard, ProgressBar, ActivityItem, CardItem } = components;
  const { formatAbsolute, formatNumber, formatRelative, sortCardsByLastScan } = utils;
  const {
    fetchCardsConfig,
    fetchCardsStatistics,
    fetchPlayerStatus,
    playCard,
    deleteCard,
    uploadCard
  } = services;

  const App = () => {
    const [cards, setCards] = useState([]);
    const [cardsLoading, setCardsLoading] = useState(true);
    const [cardsError, setCardsError] = useState(null);

    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState(null);
    const [activity, setActivity] = useState([]);

    const [player, setPlayer] = useState({
      badge: 'offline',
      badgeLabel: 'In attesa',
      state: '-',
      title: 'Stato non disponibile',
      volume: '-',
      startedAt: '-',
      source: '-',
      lastUpdated: null
    });
    const [playerLoading, setPlayerLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

    const { toast, showToast, hideToast } = useToast();

    const [formCardId, setFormCardId] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [uploading, setUploading] = useState(false);
    const [highlightCardId, setHighlightCardId] = useState(false);

    const uploadFormRef = useRef(null);
    const fileInputRef = useRef(null);
    const cardIdInputRef = useRef(null);
    const uploadSectionRef = useRef(null);
    const highlightTimeoutRef = useRef(null);

    useEffect(() => () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    }, []);

    const loadCards = useCallback(async () => {
      setCardsLoading(true);
      setCardsError(null);
      try {
        const cardsMap = await fetchCardsConfig();
        const sorted = sortCardsByLastScan(cardsMap);
        setCards(sorted);
      } catch (error) {
        setCards([]);
        setCardsError(error.message || 'Impossibile caricare le carte');
      } finally {
        setCardsLoading(false);
      }
    }, []);

    const loadStatistics = useCallback(async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const statistics = await fetchCardsStatistics();
        const totalCards = statistics.totalCards || 0;
        const configured = statistics.configuredCards || 0;
        const unknown = statistics.unknownCards || 0;
        const configuredPercent = totalCards > 0 ? Math.round((configured / totalCards) * 100) : 0;
        const unknownPercent = totalCards > 0 ? Math.round((unknown / totalCards) * 100) : 0;

        setStats({
          totalCards,
          configuredCards: configured,
          unknownCards: unknown,
          totalScans: statistics.totalScans || 0,
          totalPlays: statistics.totalPlays || 0,
          configuredPercent,
          unknownPercent,
          mostUsedCard: statistics.mostUsedCard || null
        });
        setActivity(statistics.recentActivity || []);
      } catch (error) {
        setStats(null);
        setActivity([]);
        setStatsError(error.message || 'Impossibile caricare le statistiche');
      } finally {
        setStatsLoading(false);
      }
    }, []);

    const loadPlayerStatus = useCallback(async () => {
      setPlayerLoading(true);
      try {
        const status = await fetchPlayerStatus();
        const connected = Boolean(status.connected);
        const isPlaying = Boolean(status.isPlaying);
        const isPaused = Boolean(status.isPaused);
        const playerState = status.castStatus?.playerState || (isPlaying ? 'PLAYING' : isPaused ? 'PAUSED' : 'IDLE');

        setPlayer({
          badge: connected ? (isPlaying ? 'online' : 'idle') : 'offline',
          badgeLabel: connected ? 'Connesso' : 'Disconnesso',
          state: playerState,
          title: status.title || 'Nessuna traccia in riproduzione',
          volume: typeof status.volume === 'number' ? `${Math.round(status.volume * 100)}%` : '-',
          startedAt: status.startedAt ? formatRelative(status.startedAt) : '-',
          source: status.src || '-',
          lastUpdated: new Date()
        });
      } catch (error) {
        setPlayer({
          badge: 'offline',
          badgeLabel: 'Errore',
          state: '-',
          title: 'Stato non disponibile',
          volume: '-',
          startedAt: '-',
          source: error.message || 'Stato non disponibile',
          lastUpdated: null
        });
      } finally {
        setPlayerLoading(false);
      }
    }, []);

    const refreshDashboard = useCallback(async () => {
      setIsRefreshing(true);
      await Promise.all([loadCards(), loadStatistics(), loadPlayerStatus()]);
      setIsRefreshing(false);
      setLastUpdatedAt(new Date());
    }, [loadCards, loadStatistics, loadPlayerStatus]);

    useEffect(() => {
      refreshDashboard();
      const interval = setInterval(refreshDashboard, 30000);
      return () => clearInterval(interval);
    }, [refreshDashboard]);

    const filteredCards = useMemo(() => {
      const normalized = searchTerm.trim().toLowerCase();
      if (!normalized) return cards;
      return cards.filter((card) =>
        card.cardId.toLowerCase().includes(normalized) || (card.title || '').toLowerCase().includes(normalized)
      );
    }, [cards, searchTerm]);

    const handlePlay = async (cardId) => {
      try {
        const result = await playCard(cardId);
        const playedTitle = result.played?.title || cardId;
        showToast({ type: 'success', message: `Riproduzione avviata: ${playedTitle}` });
        loadPlayerStatus();
      } catch (error) {
        showToast({ type: 'error', message: `Errore: ${error.message}` });
      }
    };

    const handleDelete = async (cardId) => {
      if (!window.confirm(`Sei sicuro di voler eliminare la carta ${cardId}?`)) {
        return;
      }
      try {
        await deleteCard(cardId);
        showToast({ type: 'success', message: `Carta ${cardId} eliminata.` });
        await loadCards();
        await loadStatistics();
      } catch (error) {
        showToast({ type: 'error', message: `Errore: ${error.message}` });
      }
    };

    const handleAssign = (cardId) => {
      setFormCardId(cardId);
      setHighlightCardId(true);
      showToast({ type: 'info', message: `Carta ${cardId} pronta per l'assegnazione. Seleziona il file audio e premi "Carica e configura".` });
      requestAnimationFrame(() => {
        if (cardIdInputRef.current) {
          cardIdInputRef.current.focus({ preventScroll: true });
        }
        if (uploadSectionRef.current) {
          uploadSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => setHighlightCardId(false), 1600);
    };

    const handleUpload = async (event) => {
      event.preventDefault();
      const audioFile = fileInputRef.current?.files?.[0];
      const trimmedCardId = formCardId.trim();
      const trimmedTitle = formTitle.trim();

      if (!trimmedCardId || !trimmedTitle || !audioFile) {
        showToast({ type: 'error', message: 'Compila tutti i campi prima di procedere.' });
        return;
      }

      setUploading(true);
      try {
        await uploadCard({ cardId: trimmedCardId, title: trimmedTitle, file: audioFile });
        showToast({ type: 'success', message: `Carta ${trimmedCardId} configurata con successo!` });
        setFormCardId('');
        setFormTitle('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        uploadFormRef.current?.reset();
        await loadCards();
        await loadStatistics();
      } catch (error) {
        showToast({ type: 'error', message: `Errore di connessione: ${error.message}` });
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#1e293b,_#0f172a_35%,_#020617_100%)]">
        <Toast toast={toast} onClose={hideToast} />
        <div className="flex min-h-screen backdrop-blur-sm">
          <aside className="hidden w-72 flex-shrink-0 flex-col gap-8 border-r border-slate-800/40 bg-slate-950/40 p-8 lg:flex">
            <div className="flex items-center gap-3 text-lg font-semibold">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/40">🎵</span>
              MusicBee
            </div>
            <nav className="space-y-2 text-sm font-medium text-slate-400">
              <a className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-slate-100 shadow-soft" href="#top">
                📊 <span>Dashboard</span>
              </a>
              <div className="flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 transition hover:border-slate-700/70 hover:bg-slate-900/40">
                📁 <span>Media library</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 transition hover:border-slate-700/70 hover:bg-slate-900/40">
                📡 <span>Cast monitor</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 transition hover:border-slate-700/70 hover:bg-slate-900/40">
                ⚙️ <span>Impostazioni</span>
              </div>
            </nav>
            <div className="mt-auto space-y-3 text-sm text-slate-400/80">
              <p className="font-semibold text-slate-300">API attiva</p>
              <p className="break-all rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-xs text-slate-400">{API_BASE}</p>
              <p className="text-xs text-slate-500">Sincronizzazione automatica ogni 30s.</p>
            </div>
          </aside>

          <main id="top" className="flex-1 space-y-10 px-6 py-10 sm:px-10 lg:px-16">
            <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Centro di controllo MusicBee</h1>
                <p className="mt-2 text-sm text-slate-400">Gestisci le carte RFID, monitora lo stato del player Cast e analizza le metriche principali.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-slate-700/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Ultimo aggiornamento: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--'}
                </span>
                <button
                  type="button"
                  onClick={refreshDashboard}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-full bg-sky-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700/70 disabled:text-slate-400"
                >
                  {isRefreshing ? '⏳ Aggiornamento...' : '🔄 Aggiorna dati'}
                </button>
              </div>
            </header>

            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Carte totali"
                value={statsLoading ? '—' : formatNumber(stats?.totalCards)}
                hint={statsError ? 'Statistiche non disponibili' : 'Include carte configurate e in attesa'}
              />
              <StatCard
                label="Carte configurate"
                value={statsLoading ? '—' : formatNumber(stats?.configuredCards)}
                hint={statsLoading ? '' : `${stats?.configuredPercent || 0}% del totale`}
                accent="text-emerald-300"
              />
              <StatCard
                label="Carte da configurare"
                value={statsLoading ? '—' : formatNumber(stats?.unknownCards)}
                hint={statsLoading ? '' : `${stats?.unknownPercent || 0}% del totale`}
                accent="text-amber-300"
              />
              <StatCard
                label="Interazioni rilevate"
                value={statsLoading ? '—' : formatNumber((stats?.totalScans || 0) + (stats?.totalPlays || 0))}
                hint={statsLoading ? '' : `${formatNumber(stats?.totalScans)} scan • ${formatNumber(stats?.totalPlays)} play`}
                accent="text-sky-300"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
              <div className="space-y-6">
                <div ref={uploadSectionRef} className="rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-card">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-100">Configura nuova carta</h2>
                      <p className="mt-1 text-sm text-slate-400">Associa rapidamente un file audio caricandolo dal tuo dispositivo.</p>
                    </div>
                  </div>
                  <form ref={uploadFormRef} onSubmit={handleUpload} className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2 md:col-span-1">
                      <label htmlFor="cardId" className="text-sm font-medium text-slate-300">ID carta</label>
                      <input
                        id="cardId"
                        ref={cardIdInputRef}
                        type="text"
                        value={formCardId}
                        onChange={(event) => setFormCardId(event.target.value)}
                        placeholder="es. 123456"
                        className={`w-full rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${highlightCardId ? 'ring-2 ring-sky-500/60 border-sky-400' : ''}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-1">
                      <label htmlFor="title" className="text-sm font-medium text-slate-300">Titolo</label>
                      <input
                        id="title"
                        type="text"
                        value={formTitle}
                        onChange={(event) => setFormTitle(event.target.value)}
                        placeholder="Nome del brano o descrizione"
                        className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <label htmlFor="audio" className="text-sm font-medium text-slate-300">File audio</label>
                      <input
                        id="audio"
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        className="block w-full cursor-pointer rounded-2xl border border-dashed border-slate-700/60 bg-slate-950/40 px-4 py-5 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-sky-500/90 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:border-sky-500/50"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={uploading}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-500/90 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:text-slate-400 md:w-auto"
                      >
                        {uploading ? '⏳ Caricamento...' : '📤 Carica e configura'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-card">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-100">Carte configurate</h2>
                      <p className="mt-1 text-sm text-slate-400">Filtra le carte per titolo o ID, avvia una riproduzione oppure elimina una configurazione.</p>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <span className="rounded-full border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {searchTerm ? `${filteredCards.length}/${cards.length} visibili` : `${cards.length} carte totali`}
                      </span>
                      {cardsError && (
                        <span className="text-xs font-semibold text-rose-300">{cardsError}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-sm">
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">🔍</span>
                      <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Cerca per titolo o ID..."
                        className="w-full rounded-full border border-slate-700/70 bg-slate-950/50 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      />
                    </div>
                    <span className="text-xs text-slate-500">Aggiornamento automatico ogni 30s</span>
                  </div>

                  <div className="mt-6">
                    {cardsLoading ? (
                      <div className="flex items-center justify-center rounded-3xl border border-slate-800/60 bg-slate-900/50 p-10 text-sm text-slate-400">
                        Caricamento carte...
                      </div>
                    ) : filteredCards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-slate-800/60 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
                        <span className="text-lg">📭</span>
                        Nessuna carta trovata. Carica un nuovo file o modifica il filtro.
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredCards.map((card) => (
                          <CardItem
                            key={card.cardId}
                            card={card}
                            onPlay={handlePlay}
                            onDelete={handleDelete}
                            onAssign={handleAssign}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-100">Stato player Cast</h2>
                      <p className="mt-1 text-sm text-slate-400">Monitora la connessione e i dettagli dell'ultimo contenuto.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusBadgeClasses[player.badge] || statusBadgeClasses.offline}`}>
                      {player.badgeLabel}
                    </span>
                  </div>
                  <div className="mt-6 space-y-4 text-sm text-slate-300">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Stato</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">{player.state}{playerLoading ? ' · caricamento' : ''}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Titolo</p>
                      <p className="mt-1 text-base text-slate-100">{player.title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Volume</p>
                        <p className="mt-1 font-semibold text-slate-100">{player.volume}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Avviato</p>
                        <p className="mt-1 font-semibold text-slate-100">{player.startedAt}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Sorgente</p>
                      <p className="mt-1 break-words text-slate-100">{player.source}</p>
                    </div>
                  </div>
                  <p className="mt-6 text-xs text-slate-500">
                    Ultimo aggiornamento: {player.lastUpdated ? formatAbsolute(player.lastUpdated) : '--'}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-card">
                  <h2 className="text-xl font-semibold text-slate-100">Attività recente</h2>
                  <p className="mt-1 text-sm text-slate-400">Gli ultimi eventi di scansione o riproduzione registrati dal sistema.</p>
                  <div className="mt-6 space-y-4">
                    {activity.length === 0 ? (
                      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
                        Nessuna attività registrata negli ultimi eventi.
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {activity.map((item, index) => (
                          <ActivityItem key={`${item.cardId}-${index}`} item={item} />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-card">
                  <h2 className="text-xl font-semibold text-slate-100">Dettagli utilizzo carte</h2>
                  <p className="mt-1 text-sm text-slate-400">Analisi rapida della distribuzione tra carte configurate e da configurare.</p>
                  <div className="mt-6 space-y-5">
                    <ProgressBar
                      label="Carte configurate"
                      value={statsLoading ? '--' : `${formatNumber(stats?.configuredCards)} (${stats?.configuredPercent || 0}%)`}
                      percent={stats?.configuredPercent || 0}
                      gradient="linear-gradient(135deg, rgba(34,197,94,0.85), rgba(56,189,248,0.85))"
                    />
                    <ProgressBar
                      label="Carte da configurare"
                      value={statsLoading ? '--' : `${formatNumber(stats?.unknownCards)} (${stats?.unknownPercent || 0}%)`}
                      percent={stats?.unknownPercent || 0}
                      gradient="linear-gradient(135deg, rgba(245,158,11,0.85), rgba(248,113,113,0.85))"
                    />
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Top card</p>
                      <p className="mt-2 text-sm font-semibold text-slate-100">
                        {stats?.mostUsedCard ? (stats.mostUsedCard.title || stats.mostUsedCard.cardId) : '--'}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {stats?.mostUsedCard
                          ? `ID ${stats.mostUsedCard.cardId} • ${formatNumber(stats.mostUsedCard.scanCount || 0)} scan • ${formatNumber(stats.mostUsedCard.playCount || 0)} play`
                          : 'Nessun dato disponibile.'}
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </section>
          </main>
        </div>
      </div>
    );
  };

  window.MusicBee.App = App;
})();
