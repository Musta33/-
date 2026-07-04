import mongoose from 'mongoose';
import { models } from './server/models.js'; // need to compile? No, let's just make a script

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
mongoose.connect(uri)
  .then(async () => {
    console.log("Connected to DB");
    const adminUser = await mongoose.connection.collection('users').findOne({ email: 'mustfadd112@gmail.com' });
    console.log("Admin User:", adminUser);
    
    if (adminUser && adminUser.companyId) {
       const company = await mongoose.connection.collection('companies').findOne({ id: adminUser.companyId });
       console.log("Company:", company?._id);
       if(company) console.log(JSON.stringify(company, null, 2));
    }
    process.exit(0);
  })
  .catch(console.error);
