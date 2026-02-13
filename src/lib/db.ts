import mongoose from 'mongoose';

function buildMongoUri() {
  const directUri = process.env.MONGODB_URI?.trim();
  if (directUri) {
    return directUri;
  }

  const username = process.env.MONGODB_USERNAME?.trim();
  const password = process.env.MONGODB_PASSWORD?.trim();
  const host = process.env.MONGODB_CLUSTER_HOST?.trim();

  if (username && password && host) {
    const encodedUser = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);
    const dbName = process.env.MONGODB_DATABASE?.trim();
    const appName = process.env.MONGODB_APP_NAME?.trim() || 'Andra-Meals-Cluster';
    const dbPath = dbName ? `/${dbName}` : '/';

    return `mongodb+srv://${encodedUser}:${encodedPassword}@${host}${dbPath}?retryWrites=true&w=majority&appName=${encodeURIComponent(appName)}`;
  }

  throw new Error(
    'Please define MONGODB_URI or set MONGODB_USERNAME, MONGODB_PASSWORD, and MONGODB_CLUSTER_HOST in .env.local'
  );
}
const MONGODB_URI = buildMongoUri();

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB connected successfully');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
