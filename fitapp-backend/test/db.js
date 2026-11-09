// Connects mongoose to a throwaway test database and drops it afterwards.
// Refuses any database whose name does not end in "_test".
const mongoose = require('mongoose');

const TEST_URI = process.env.MONGO_TEST_URI || 'mongodb://mongoosedb:27017/fitapp_test?replicaSet=rs0';

async function connectTestDb() {
  const dbName = new URL(TEST_URI.replace(/^mongodb:/, 'http:')).pathname.slice(1);
  if (!dbName.endsWith('_test')) throw new Error(`Refusing to use non-test database "${dbName}"`);
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.db.dropDatabase();
}

async function resetTestDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function disconnectTestDb() {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
}

// A date `n` days from today at local midnight (the app normalizes to midnight).
function daysFromToday(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

module.exports = { connectTestDb, resetTestDb, disconnectTestDb, daysFromToday, ymd };
