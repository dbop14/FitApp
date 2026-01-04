// Script to fix admin field for existing challenges
// Run this in MongoDB shell or as a Node.js script

// Update existing challenges to set admin field based on creatorEmail
// This assumes the creatorEmail matches a user's email in the users collection

// First, let's see what challenges exist
print("Current challenges:");
db.challenges.find({}, {name: 1, creatorEmail: 1, admin: 1}).forEach(function(challenge) {
  print(`- ${challenge.name}: creator=${challenge.creatorEmail}, admin=${challenge.admin || 'NOT SET'}`);
});

// Find users to map emails to Google IDs
print("\nUsers in database:");
const userMap = {};
db.users.find({}, {email: 1, googleId: 1}).forEach(function(user) {
  userMap[user.email] = user.googleId;
  print(`- ${user.email}: ${user.googleId}`);
});

// Update challenges to set admin field
print("\nUpdating challenges...");
db.challenges.find({}).forEach(function(challenge) {
  if (!challenge.admin && challenge.creatorEmail) {
    const googleId = userMap[challenge.creatorEmail];
    if (googleId) {
      db.challenges.updateOne(
        {_id: challenge._id},
        {$set: {admin: googleId}}
      );
      print(`✅ Updated ${challenge.name}: set admin to ${googleId} (${challenge.creatorEmail})`);
    } else {
      print(`⚠️ Could not find Google ID for ${challenge.creatorEmail} in challenge ${challenge.name}`);
    }
  } else if (challenge.admin) {
    print(`ℹ️ Challenge ${challenge.name} already has admin: ${challenge.admin}`);
  } else {
    print(`⚠️ Challenge ${challenge.name} has no creatorEmail or admin`);
  }
});

// Show final state
print("\nFinal challenge state:");
db.challenges.find({}, {name: 1, creatorEmail: 1, admin: 1}).forEach(function(challenge) {
  print(`- ${challenge.name}: creator=${challenge.creatorEmail}, admin=${challenge.admin || 'NOT SET'}`);
});

print("\nAdmin field fix completed!"); 