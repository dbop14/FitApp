// Script to fix user profile issues
// Run this in MongoDB shell or as a Node.js script

// 1. Find and remove duplicate users (keep the one with most complete data)
db.users.aggregate([
  {
    $group: {
      _id: "$googleId",
      users: { $push: "$$ROOT" },
      count: { $sum: 1 }
    }
  },
  {
    $match: {
      count: { $gt: 1 }
    }
  }
]).forEach(function(group) {
  // Keep the user with the most complete data
  let bestUser = group.users[0];
  group.users.forEach(function(user) {
    if (user.picture && !bestUser.picture) {
      bestUser = user;
    } else if (user.name && !bestUser.name) {
      bestUser = user;
    } else if (user.email && !bestUser.email) {
      bestUser = user;
    }
  });
  
  // Remove duplicates, keep the best one
  group.users.forEach(function(user) {
    if (user._id.toString() !== bestUser._id.toString()) {
      db.users.deleteOne({ _id: user._id });
      print("Removed duplicate user: " + user.email);
    }
  });
});

// 2. Update users without pictures to have a default
db.users.updateMany(
  { picture: { $exists: false } },
  { $set: { picture: null } }
);

// 3. Find "Unknown User" entries and try to fix them
db.challengeparticipants.find({}).forEach(function(participant) {
  const user = db.users.findOne({ googleId: participant.userId });
  if (!user) {
    print("Found participant without user: " + participant.userId);
  }
});

print("User profile cleanup completed!"); 