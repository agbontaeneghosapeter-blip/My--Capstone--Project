function normalizePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new TypeError('Route paths must start with /');
  }
  const pathname = path.split(/[?#]/, 1)[0];
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class Router {
  #routes = [];

  add(method, path, handler) {
    if (typeof handler !== 'function') throw new TypeError('Route handler must be a function');
    const normalizedPath = normalizePath(path);
    const segments = normalizedPath === '/' ? [] : normalizedPath.slice(1).split('/');
    const params = [];
    const pattern = segments.map((segment) => {
      if (segment.startsWith(':')) {
        const name = segment.slice(1);
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
          throw new TypeError(`Invalid route parameter: ${segment}`);
        }
        params.push(name);
        return '([^/]+)';
      }
      return escapeRegex(segment);
    }).join('/');

    this.#routes.push({
      method: String(method).toUpperCase(),
      params,
      pattern: new RegExp(normalizedPath === '/' ? '^/$' : `^/${pattern}/?$`),
      handler,
    });
    return this;
  }

  match(method, path) {
    const normalizedPath = normalizePath(path);
    const requestMethod = String(method).toUpperCase();
    for (const route of this.#routes) {
      if (route.method !== requestMethod) continue;
      const match = route.pattern.exec(normalizedPath);
      if (!match) continue;

      const params = {};
      try {
        route.params.forEach((name, index) => {
          params[name] = decodeURIComponent(match[index + 1]);
        });
      } catch {
        return null;
      }
      return { handler: route.handler, params };
    }
    return null;
  }
}