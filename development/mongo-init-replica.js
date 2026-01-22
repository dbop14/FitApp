// MongoDB replica set initialization script
// This will be executed automatically by MongoDB's docker-entrypoint-initdb.d mechanism
// However, MongoDB doesn't support docker-entrypoint-initdb.d for replica sets
// So this is kept as a reference for manual initialization

try {
  const status = rs.status();
  print('Replica set already initialized:', status.set);
} catch (err) {
  print('Initializing replica set...');
  const result = rs.initiate({
    _id: 'rs0',
    members: [
      { _id: 0, host: 'mongoosedb:27017' }
    ]
  });
  print('Replica set initialization result:', JSON.stringify(result));
  print('Replica set initialized successfully');
}
