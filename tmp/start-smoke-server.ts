import { app } from '../identity/src/server.ts';

const port = Number(process.env.PORT || 4567);
app.listen(port, '127.0.0.1', () => {
  console.log(`smoke-server ready on ${port}`);
});

// keep process alive
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
