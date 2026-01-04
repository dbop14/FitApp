// Script to check challenge users and debug "Unknown User" issue
// Run this in MongoDB shell or as a Node.js script

print("=== Challenge Users Debug ===");

// Check all challenges
print("\n1. All Challenges:");
db.challenges.find({}, {name: 1, creatorEmail: 1, admin: 1, participants: 1}).forEach(function(challenge) {
  print(`\nChallenge: ${challenge.name}`);
  print(`  Creator Email: ${challenge.creatorEmail}`);
  print(`  Admin: ${challenge.admin || 'NOT SET'}`);
  print(`  Participants: ${challenge.participants ? challenge.participants.join(', ') : 'NONE'}`);
});

// Check all users
print("\n2. All Users:");
db.users.find({}, {name: 1, email: 1, googleId: 1, picture: 1}).forEach(function(user) {
  const hasPicture = !!user.picture;
  print(`- ${user.name || 'NO NAME'} (${user.email}): googleId=${user.googleId}, picture=${hasPicture ? 'YES' : 'NO'}`);
});

// Check all participants
print("\n3. All Challenge Participants:");
db.challengeparticipants.find({}, {challengeId: 1, userId: 1, startingWeight: 1}).forEach(function(participant) {
  const user = db.users.findOne({googleId: participant.userId});
  const challenge = db.challenges.findOne({_id: ObjectId(participant.challengeId)});
  print(`- Challenge: ${challenge ? challenge.name : 'UNKNOWN'}`);
  print(`  User ID: ${participant.userId}`);
  print(`  User Found: ${user ? 'YES' : 'NO'}`);
  if (user) {
    print(`  User Name: ${user.name || 'NO NAME'}`);
    print(`  User Email: ${user.email}`);
    print(`  Has Picture: ${user.picture ? 'YES' : 'NO'}`);
  }
  print(`  Starting Weight: ${participant.startingWeight}`);
  print('');
});

// Check for specific issues
print("\n4. Potential Issues:");

// Check for participants without user records
print("\nParticipants without user records:");
db.challengeparticipants.find({}).forEach(function(participant) {
  const user = db.users.findOne({googleId: participant.userId});
  if (!user) {
    print(`❌ Participant ${participant.userId} in challenge ${participant.challengeId} has no user record`);
  }
});

// Check for users with no name
print("\nUsers with no name:");
db.users.find({name: {$exists: false}}).forEach(function(user) {
  print(`❌ User ${user.email} (${user.googleId}) has no name field`);
});

// Check for users with null/empty name
print("\nUsers with null/empty name:");
db.users.find({$or: [{name: null}, {name: ""}, {name: {$exists: false}}]}).forEach(function(user) {
  print(`❌ User ${user.email} (${user.googleId}) has null/empty name`);
});

print("\n=== Debug Complete ==="); 