import { createApp } from './http/app.js';
import { config } from './config.js';

const server = createApp();
server.listen(config.port, () => {
  const address = server.address();
  const port = typeof address === 'object' ? address.port : config.port;
  console.log(`Event ticketing server listening on http://localhost:${port}`);
});