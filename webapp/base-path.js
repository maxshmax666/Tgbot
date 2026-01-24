(() => {
  const DEFAULT_BASE = './';
  const baseElement = document.querySelector('base') ?? document.createElement('base');

  const { pathname } = window.location;
  const basePath = pathname.endsWith('/')
    ? pathname
    : pathname.slice(0, pathname.lastIndexOf('/') + 1);

  baseElement.setAttribute('href', basePath || DEFAULT_BASE);

  if (!baseElement.isConnected) {
    document.head.prepend(baseElement);
  }

  window.APP_BASE_PATH = baseElement.getAttribute('href') || DEFAULT_BASE;
})();
