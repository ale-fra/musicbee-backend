(function () {
  if (!window.Babel) {
    throw new Error('Babel standalone is required before loading the dashboard app.');
  }

  const moduleCache = new Map();

  const transformOptions = {
    presets: [
      [window.Babel.availablePresets['env'], { modules: 'commonjs', targets: { esmodules: false } }],
      window.Babel.availablePresets['react']
    ],
    sourceType: 'module'
  };

  const fetchSource = (url) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send(null);

    if (request.status >= 400 || request.status === 0) {
      throw new Error(`Unable to load module: ${url}`);
    }

    return request.responseText;
  };

  const resolveSpecifier = (baseUrl, specifier) => {
    return new URL(specifier, baseUrl).href;
  };

  const loadModule = (entryUrl) => {
    const normalizedUrl = resolveSpecifier(window.location.href, entryUrl);

    if (moduleCache.has(normalizedUrl)) {
      return moduleCache.get(normalizedUrl).exports;
    }

    const source = fetchSource(normalizedUrl);
    const { code } = window.Babel.transform(source, {
      ...transformOptions,
      filename: normalizedUrl
    });

    const module = { exports: {} };
    moduleCache.set(normalizedUrl, module);

    const localRequire = (specifier) => {
      const childUrl = resolveSpecifier(normalizedUrl, specifier);
      return loadModule(childUrl);
    };

    const wrappedFactory = new Function('exports', 'require', 'module', code);
    wrappedFactory(module.exports, localRequire, module);

    return module.exports;
  };

  try {
    loadModule('./app/main.jsx');
  } catch (error) {
    console.error('Failed to bootstrap dashboard application:', error);
  }
})();
