const sdk = require('matrix-js-sdk');
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Challenge = require('./models/Challenge');

// MongoDB connection
const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fitapp');
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }
};

// Matrix client setup
let matrixClient = null;
const connectMatrix = async () => {
  try {
    const botUsername = process.env.BOT_USERNAME || 'fitness_motivator';
    const botPassword = process.env.BOT_PASSWORD;
    const matrixServerName = process.env.MATRIX_SERVER_NAME || 'fitapp.local';
    const matrixUrl = process.env.MATRIX_HOMESERVER_URL || 'http://localhost:8008';
    
    if (!botPassword) {
      throw new Error('BOT_PASSWORD not set');
    }
    
    const client = sdk.createClient({
      baseUrl: matrixUrl,
      userId: `@${botUsername}:${matrixServerName}`,
      accessToken: null,
    });

    const response = await client.login('m.login.password', {
      user: botUsername,
      password: botPassword,
    });

    client.setAccessToken(response.access_token);
    matrixClient = client;
    
    console.log('✅ Connected to Matrix');
    return client;
  } catch (err) {
    console.error('❌ Matrix connection failed:', err.message);
    throw err;
  }
};

// Create Matrix room for challenge
const createMatrixRoom = async (challenge) => {
  if (!matrixClient) {
    console.error('❌ Matrix client not connected');
    return null;
  }

  try {
    console.log(`\n📋 Creating Matrix room for challenge: "${challenge.name}"`);
    
    const matrixServerName = process.env.MATRIX_SERVER_NAME || 'fitapp.local';
    const roomAlias = `#challenge-${challenge._id}:${matrixServerName}`;
    
    // First, try to resolve the existing room alias
    try {
      console.log(`   Checking if room alias already exists: ${roomAlias}`);
      const roomInfo = await matrixClient.getRoomIdForAlias(roomAlias);
      if (roomInfo && roomInfo.room_id) {
        console.log(`✅ Found existing Matrix room: ${roomInfo.room_id}`);
        challenge.matrixRoomId = roomInfo.room_id;
        await challenge.save();
        console.log(`✅ Saved existing Matrix room ID to challenge`);
        return roomInfo.room_id;
      }
    } catch (aliasErr) {
      // Alias doesn't exist, continue to create room
      console.log(`   Room alias doesn't exist, will create new room`);
    }
    
    // Create room without alias if alias is taken, or with alias if available
    const roomOptions = {
      preset: 'public_chat',
      name: `${challenge.name} - Fitness Challenge`,
      topic: `Fitness challenge: ${challenge.stepGoal || 10000} steps daily goal. Duration: ${challenge.startDate} to ${challenge.endDate}`,
      visibility: 'public'
    };
    
    // Try with alias first, if that fails, try without
    try {
      roomOptions.room_alias_name = `challenge-${challenge._id}`;
      const createResponse = await matrixClient.createRoom(roomOptions);
      // Handle both string (old API) and object (new API) responses
      const roomId = typeof createResponse === 'string' ? createResponse : (createResponse.room_id || createResponse);
      console.log(`✅ Created Matrix room: ${roomId}`);
      challenge.matrixRoomId = roomId;
      await challenge.save();
      console.log(`✅ Saved Matrix room ID to challenge`);
      return roomId;
    } catch (createErr) {
      if (createErr.data && createErr.data.errcode === 'M_ROOM_IN_USE') {
        console.log(`   Room alias is taken, creating room without alias...`);
        delete roomOptions.room_alias_name;
        const createResponse = await matrixClient.createRoom(roomOptions);
        // Handle both string (old API) and object (new API) responses
        const roomId = typeof createResponse === 'string' ? createResponse : (createResponse.room_id || createResponse);
        console.log(`✅ Created Matrix room (without alias): ${roomId}`);
        challenge.matrixRoomId = roomId;
        await challenge.save();
        console.log(`✅ Saved Matrix room ID to challenge`);
        return roomId;
      }
      throw createErr;
    }
  } catch (err) {
    console.error('❌ Error creating Matrix room:', err.message);
    if (err.data) {
      console.error('   Error details:', JSON.stringify(err.data, null, 2));
    }
    return null;
  }
};

// Main function
const main = async () => {
  try {
    // Get challenge code from command line or use default
    const challengeCode = process.argv[2] || 'FIT49850';
    
    await connectMongo();
    await connectMatrix();

    // Find challenge by code
    const challenge = await Challenge.findOne({ challengeCode });
    
    if (!challenge) {
      console.error(`❌ Challenge not found with code: ${challengeCode}`);
      process.exit(1);
    }

    console.log(`✅ Found challenge: "${challenge.name}" (ID: ${challenge._id})`);
    
    if (challenge.matrixRoomId) {
      console.log(`⚠️  Challenge already has a Matrix room ID: ${challenge.matrixRoomId}`);
      console.log('   Use --force to recreate it');
      
      if (process.argv.includes('--force')) {
        console.log('   Force flag detected, creating new room...');
        await createMatrixRoom(challenge);
      } else {
        console.log('   Exiting. Use --force to create a new room.');
      }
    } else {
      await createMatrixRoom(challenge);
    }
    
    // Close connections
    await mongoose.disconnect();
    if (matrixClient) {
      await matrixClient.stopClient();
    }
    
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

main();
