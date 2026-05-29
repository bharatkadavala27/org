import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set');
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      family: 4,
    });
    const { host, name } = mongoose.connection;
    console.log(`✓ MongoDB connected: ${host}/${name}`);
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err.message);
    throw err;
  }
}
