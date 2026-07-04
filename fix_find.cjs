const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Replace findOne in getOne
content = content.replace(
  "const mongoItem = await Model.findOne({ $or: [{id: id}, {_id: id}] });",
  "const mongoItem = await Model.findOne(mongoose.Types.ObjectId.isValid(id) ? { $or: [{id: id}, {_id: id}] } : { id: id });"
);

// Replace findOne in staff route
content = content.replace(
  "const staff = await Model.findOne({ $or: [{ id: uid }, { userId: uid }] });",
  "const staff = await Model.findOne(mongoose.Types.ObjectId.isValid(uid) ? { $or: [{ id: uid }, { userId: uid }, { _id: uid }] } : { $or: [{ id: uid }, { userId: uid }] });"
);

fs.writeFileSync('server.ts', content);
console.log('Fixed findOne cast errors');
