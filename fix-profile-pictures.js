// Script to check and fix user profile pictures
// Run this in MongoDB shell or as a Node.js script

print("=== Profile Picture Check ===");

// Check all users and their profile pictures
print("\n1. Checking all users:");
db.users.find({}, {name: 1, email: 1, picture: 1}).forEach(function(user) {
  const hasPicture = !!user.picture;
  const pictureType = user.picture ? (user.picture.startsWith('data:') ? 'data URL' : 'URL') : 'none';
  print(`- ${user.name || 'Unknown'} (${user.email}): ${hasPicture ? '✅' : '❌'} ${pictureType}`);
});

// Check participants and their associated users
print("\n2. Checking challenge participants:");
db.challengeparticipants.find({}).forEach(function(participant) {
  const user = db.users.findOne({googleId: participant.userId});
  if (user) {
    const hasPicture = !!user.picture;
    print(`- Participant ${user.name} (${user.email}): ${hasPicture ? '✅' : '❌'} has picture`);
  } else {
    print(`- Participant ${participant.userId}: ❌ No user record found`);
  }
});

// Check leaderboard data
print("\n3. Checking leaderboard data:");
db.challenges.find({}).forEach(function(challenge) {
  print(`\nChallenge: ${challenge.name}`);
  db.challengeparticipants.find({challengeId: challenge._id.toString()}).forEach(function(participant) {
    const user = db.users.findOne({googleId: participant.userId});
    if (user) {
      const hasPicture = !!user.picture;
      print(`  - ${user.name}: ${hasPicture ? '✅' : '❌'} has picture`);
    } else {
      print(`  - ${participant.userId}: ❌ No user record`);
    }
  });
});

print("\n=== Profile Picture Check Complete ==="); 