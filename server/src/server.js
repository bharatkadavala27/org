import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './lib/db.js';

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB(process.env.MONGODB_URI);
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`✓ API listening on http://localhost:${PORT}`);
      console.log(`  Health: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

// touch