function parsePort(value) {
  const configuredPort = value === undefined ? '' : String(value).trim();
  if (configuredPort === '') return 3000;
  const port = Number(configuredPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError('PORT must be a whole number between 0 and 65535');
  }
  return port;
}

export function loadConfig(env = process.env) {
  return Object.freeze({ port: parsePort(env.PORT) });
}

export const config = loadConfig();