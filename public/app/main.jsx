window.MusicBee = window.MusicBee || {};

const { App } = window.MusicBee;

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
