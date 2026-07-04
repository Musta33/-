import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import mongoose from 'mongoose';
import multer from 'multer';

// Global error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

import { models, collectionModelMap } from './server/models.ts';
import { initConcealedBot } from "./src/lib/telegramConcealedBot.ts";

const sanitize = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
      return obj;
  }
  
  const sanitized: any = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
      if (key.startsWith('$')) {
          continue; // Remove NoSQL operators
      }
      
      if (typeof obj[key] === 'object') {
          sanitized[key] = sanitize(obj[key]);
      } else {
          sanitized[key] = obj[key];
      }
  }
  
  return sanitized;
};

// Mongoose connection
let connectionPromise: Promise<boolean> | null = null;
let lastConnectAttempt = 0;
let lastConnectFailed = false;

async function connectDB(): Promise<boolean> {
  if (mongoose.connection.readyState === 1) return true;
  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) return false; // Skip if neither is configured

  const now = Date.now();
  // If a connection attempt failed in the last 30 seconds, fall back instantly to avoid blocking requests
  if (lastConnectFailed && (now - lastConnectAttempt < 30000)) {
    return false;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI!;

  if (!connectionPromise) {
    lastConnectAttempt = now;
    connectionPromise = (async () => {
      try {
        mongoose.set('bufferCommands', false);
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 2000 // Fast timeout (2 seconds instead of 5)
        });
        console.log('MongoDB connected successfully');
        try {
          await mongoose.connection.collection('companies').dropIndex('handle_1');
          console.log('Successfully dropped legacy handle_1 index');
        } catch (idxErr: any) {
          if (idxErr.codeName !== 'IndexNotFound') {
             console.error('Could not drop index handle_1', idxErr.message);
          }
        }
        lastConnectFailed = false;
        return true;
      } catch (e) {
        console.error('MongoDB connection error:', e);
        lastConnectFailed = true;
        connectionPromise = null; // Reset for next retry after cooldown
        return false;
      }
    })();
  }
  return connectionPromise;
}

// Local Storage Setup
const USERS_FILE = path.join(process.cwd(), "users.json");
const DATA_FILE = path.join(process.cwd(), "db.json");

let memoryUsers: any = null;
let memoryData: any = null;

const getUsers = () => {
  if (memoryUsers) return memoryUsers;
  if (!fs.existsSync(USERS_FILE)) {
    memoryUsers = [];
    return memoryUsers;
  }
  try {
    memoryUsers = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    return memoryUsers;
  } catch (e) {
    memoryUsers = [];
    return memoryUsers;
  }
};

const saveUsers = (users: any) => {
  memoryUsers = users;
  fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), (err) => {
    if (err) console.error("Failed to write users.json asynchronously", err);
  });
};

const getData = () => {
  if (memoryData) return memoryData;
  if (!fs.existsSync(DATA_FILE)) {
    memoryData = {
      companies: [],
      staff: [],
      system_tasks: [],
      customers: [],
      inventory: [],
      contracts: [],
      blocklist: [],
      external_blocklist: [],
      notifications: [],
      chats: [],
      messages: []
    };
    return memoryData;
  }
  try {
    memoryData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return memoryData;
  } catch (e) {
    memoryData = {};
    return memoryData;
  }
};

const saveData = (data: any) => {
  memoryData = data;
  fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), (err) => {
    if (err) console.error("Failed to write db.json asynchronously", err);
  });
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "iraq_rental_local_secret_key_123";

async function startServer() {
  const app = express();
  
  // Middleware and routes moved here properly
  app.use(express.json({ limit: '10mb' })); // Allow higher limit for base64 images 
  app.use((req: any, res: any, next: any) => {
      console.log(`${req.method} ${req.url}`);
      if (req.body) req.body = sanitize(req.body);
      if (req.query) req.query = sanitize(req.query);
      if (req.params) req.params = sanitize(req.params);
      next();
  });
  
  app.get("/api/health", (req, res) => {
    try {
      const isMongoConnected = mongoose.connection.readyState === 1;
      res.json({ 
        status: "ok", 
        backend: isMongoConnected ? "mongodb" : "local-file-system",
        mongoConnected: isMongoConnected,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      });
    } catch (e) {
      res.status(500).json({ status: "error", message: String(e) });
    }
  });

  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = 3000;

  io.on('connection', (socket) => {
    console.log('User connected', socket.id);
    socket.on('chatMessage', (msg) => {
        socket.broadcast.emit('chatMessage', msg);
        io.emit('newNotification', msg);
    });
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
  });

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (mongoUri) {
    connectDB().then((connected) => {
      if (connected) {
         console.log("🚀 تم تأكيد الاتصال بقاعدة بيانات MongoDB بنجاح.");
      } else {
         console.log("⚠️ فشل الاتصال المبدئي بقاعدة البيانات MongoDB.");
      }
    });
  } else {
    console.warn("⚠️ لم يتم العثور على MONGO_URI أو MONGODB_URI في البيئة. يعمل التطبيق حالياً بنظام الملفات المحلي المؤقت.");
  }


  app.get("/api/notifications", authenticateToken, async (req: any, res: any) => {
    console.log("Fetching notifications for user:", req.user?.id, "companyId:", req.user?.companyId);
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    
    try {
        const dbConnected = await connectDB();
        if (dbConnected) {
            const Model = collectionModelMap['notifications'];
            const query = companyId ? { companyId } : { userId };
            const notifications = await Model.find(query).sort({ createdAt: -1 });
            // console.log("Fetched notifications:", JSON.stringify(notifications));
            return res.json(notifications);
        }
        
        // Fallback to local data if DB not connected
        const data = getData();
        const localItems = data.notifications || [];
        const filtered = companyId 
          ? localItems.filter((n: any) => n.companyId === companyId)
          : localItems.filter((n: any) => n.userId === userId);
        
        res.json(filtered.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }));
    } catch (e) {
        console.error('Error fetching notifications:', e);
        res.status(500).json({ message: "خطأ في جلب الإشعارات" });
    }
  });

  function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]?.replace(/^"|"$/g, '');

    if (!token || token === 'null' || token === 'undefined') return res.status(401).json({ message: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
      if (err) return res.status(401).json({ message: "Invalid token", error: err.message });
      req.user = user;

      // Ensure super_admin and master account can always access
      if (user.role === 'super_admin' || user.role === 'superadmin' || user.email === 'mustfadd112@gmail.com') {
         return next();
      }

      next();
    });
  }


  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/api/send-telegram", authenticateToken, upload.single('photo'), async (req: any, res: any) => {
    const { message, chatId } = req.body;
    const photo = req.file;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.ALLOWED_GROUP_ID;
    const userId = req.user?.id;

    if (!token) {
        res.status(500).json({ error: "Telegram token not configured" });
        return;
    }

    try {
      // Use the actual Telegram group ID if chatId is '2'
      const targetChatId = (chatId === '2') ? telegramChatId : (chatId || telegramChatId);
      console.log(`Sending to Telegram. Chat ID: ${targetChatId}, Message: ${message}, HasPhoto: ${!!photo}`);

      // 2. Telegram Send
      if (photo) {
          const formData = new FormData();
          formData.append('chat_id', targetChatId);
          formData.append('photo', new Blob([photo.buffer]), 'photo.jpg');
          if (message) formData.append('caption', message);

          const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
              method: 'POST',
              body: formData as any
          });
          const result = await response.json();
          if (!response.ok) {
            console.error('Telegram sendPhoto error (Chat ID: ', targetChatId, '):', result);
            res.status(500).json({ error: "Failed to send photo to Telegram", details: result });
            return;
          }
      } else if (message) {
          const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: targetChatId, text: message })
          });
          const result = await response.json();
          if (!response.ok) {
            console.error('Telegram sendMessage error (Chat ID: ', targetChatId, '):', result);
            res.status(500).json({ error: "Failed to send message to Telegram", details: result });
            return;
          }
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Internal Telegram error:', error);
      res.status(500).json({ error: "Failed to send to Telegram", errorDetails: error });
    }
  });

  // --- Gemini ID Extraction ---
  app.post("/api/extract-id", authenticateToken, async (req: any, res: any) => {
    const { base64ImageBytes, mimeType } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "لم يتم تكوين مفتاح الذكاء الاصطناعي على السيرفر." });
    }

    if (!base64ImageBytes || !mimeType) {
      return res.status(400).json({ error: "بيانات الصورة غير مكتملة" });
    }

    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `أنت خبير في استخراج البيانات من المستمسكات العراقية (البطاقة الوطنية، هوية الأحوال المدنية، إجازة السوق، بطاقة السكن).
مهمتك هي استخراج المعلومات التالية بدقة عالية جداً من الصورة المرفقة:
1. الاسم الكامل (fullName): الاسم الثلاثي أو الرباعي كما هو مكتوب.
2. رقم المستمسك (idNumber): رقم البطاقة أو الهوية.
3. العنوان (address): السكن أو المحافظة/المنطقة.
4. تاريخ الميلاد (birthDate): بصيغة YYYY-MM-DD.
5. تاريخ الانتهاء (expiryDate): بصيغة YYYY-MM-DD.
6. تاريخ الإصدار (issueDate): بصيغة YYYY-MM-DD.

ملاحظة: إذا كان التاريخ مكتوباً بالتقويم الهجري، حاول تحويله للميلادي أو استخرجه كما هو. كن دقيقاً جداً في قراءة الأسماء العربية.`;

    try {
      const interaction = await ai.interactions.create({
        model: "gemini-1.5-flash",
        input: [
          { type: "text", text: prompt },
          { 
            type: "image", 
            data: base64ImageBytes.split(",")[1] || base64ImageBytes, 
            mime_type: mimeType 
          }
        ],
        system_instruction: "أنت محرك استخراج بيانات (OCR) متخصص في الوثائق الرسمية العراقية. رد دائماً بصيغة JSON نظيفة.",
        response_format: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            idNumber: { type: Type.STRING },
            address: { type: Type.STRING },
            birthDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            issueDate: { type: Type.STRING }
          }
        }
      });

      const extracted = JSON.parse(interaction.output_text || "{}");

      // Save extracted ID to database automatically
      const dbConnected = await connectDB();
      const userId = req.user?.id;
      if (dbConnected) {
        try {
          const Identity = collectionModelMap['identities'];
          if (Identity) {
            const newIdentity = new Identity({
              fullName: extracted.fullName,
              idNumber: extracted.idNumber,
              address: extracted.address,
              birthDate: extracted.birthDate,
              expiryDate: extracted.expiryDate,
              issueDate: extracted.issueDate,
              userId: userId,
              scannedAt: new Date()
            });
            await newIdentity.save();
            console.log("Saved identity to MongoDB:", extracted, "for user:", userId);
          }
        } catch (dbErr) {
          console.error("Failed to save identity to MongoDB:", dbErr);
        }
      } else {
        // Fallback to local storage (db.json)
        try {
          const data = getData();
          if (!data.identities) data.identities = [];
          data.identities.push({
            id: Date.now().toString(),
            fullName: extracted.fullName,
            idNumber: extracted.idNumber,
            userId: userId,
            scannedAt: new Date().toISOString()
          });
          saveData(data);
          console.log("Saved identity to local storage:", extracted, "for user:", userId);
        } catch (fsErr) {
          console.error("Failed to save identity to local storage:", fsErr);
        }
      }

      res.json(extracted);
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message || "فشل في قراءة الصورة" });
    }
  });

  app.post("/api/match-face", authenticateToken, upload.single('photo'), async (req: any, res: any) => {
      console.log("DEBUG: /api/match-face route hit");
      const photo = req.file;
      console.log("DEBUG: Photo received:", photo ? "Yes" : "No");
      if (!photo) return res.status(400).json({ error: "الصورة مطلوبة" });

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "لا يوجد مفتاح API" });

      const blocklistDocs = await models.Blocklist.find({}).lean();
      const externalBlocklistDocs = await models.ExternalBlocklist.find({}).lean();
      const blocklist = [...blocklistDocs, ...externalBlocklistDocs];
      console.log("DEBUG: Blocklist size from DB:", blocklist.length);

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `أنت خبير في التعرف على الوجوه والمقارنة الدقيقة لملامح الوجه (العيون، الأنف، الفم، وشكل الوجه).
      قارن صورة الوجه المرفقة بدقة شديدة مع الصور التالية.
      قم بتحليل الملامح بشكل مفصل قبل اتخاذ القرار.
      ${JSON.stringify(blocklist.map((b: any) => ({ id: b.idNumber || b.identityNumber || b.id, name: b.name || b.fullName, url: b.imageUrl || b.logoUrl || b.photoUrl })))}
      أرجع البيانات بصيغة JSON:
      {
         "isMatch": boolean,
         "name": string | null,
         "idNumber": string | null,
         "blockReason": string | null,
         "matchPercentage": number | null,
         "analysis": string
      }`;

      try {
          const interaction = await ai.interactions.create({
              model: "gemini-1.5-flash",
              input: [
                  { type: "text", text: prompt },
                  { type: "image", data: photo.buffer.toString('base64'), mime_type: photo.mimetype }
              ],
              system_instruction: "أنت نظام مطابقة وجوه احترافي، رد دائماً بصيغة JSON.",
              response_format: {
                  type: Type.OBJECT,
                  properties: {
                      isMatch: { type: Type.BOOLEAN },
                      name: { type: Type.STRING },
                      idNumber: { type: Type.STRING },
                      blockReason: { type: Type.STRING },
                      matchPercentage: { type: Type.NUMBER },
                      analysis: { type: Type.STRING }
                  }
              }
          });

          const result = JSON.parse(interaction.output_text || "{}");
          if (result.isMatch) {
              const matchedPerson = blocklist.find((b: any) => b.name === result.name || b.idNumber === result.idNumber);
              if (matchedPerson) {
                  result.imageUrl = (matchedPerson as any).imageUrl;
              }
          }
          res.json(result);
      } catch (error) {
          console.error("Match face error:", error);
          res.status(500).json({ error: "فشل في المطابقة" });
      }
  });

  // --- Password Reset Route ---
  app.post("/api/toggle-account", authenticateToken, async (req: any, res: any) => {
    const { userId, isLockedBySystem } = req.body;
    if (!userId) return res.status(400).json({ message: "يرجى توفير معرف المستخدم" });

    const dbConnected = await connectDB();
    if (dbConnected) {
      try {
        const User = collectionModelMap['users'];
        await User.updateOne({ id: userId }, { $set: { isLockedBySystem: isLockedBySystem } });
        return res.json({ message: "تم تحديث حالة الحساب بنجاح" });
      } catch (e) {
         console.error("error updating user toggle data in mongo:", e);
      }
    }
    
    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.id === userId);
    if (userIndex !== -1) {
        users[userIndex].isLockedBySystem = isLockedBySystem;
        saveUsers(users);
        return res.json({ message: "تم تحديث حالة الحساب بنجاح" });
    }
    
    res.status(404).json({ message: "لم يتم العثور على الحساب" });
  });

  app.post("/api/approve-password-update", async (req, res) => {
    const { companyId, userId } = req.body;
    if (!companyId && !userId) return res.status(400).json({ message: "يرجى توفير معرف الشركة أو المستخدم" });

    const dbConnected = await connectDB();
    if (dbConnected) {
      try {
        const User = collectionModelMap['users'];
        const Company = collectionModelMap['companies'];
        let query: any = {};
        if (userId) {
            query = { id: userId };
        } else {
            // Find any user in this company that has a pending password or is locked
            query = { 
              companyId: companyId, 
              $or: [
                { pendingPassword: { $exists: true, $ne: null } },
                { isLockedBySystem: true },
                { lockUntil: { $exists: true, $ne: null } }
              ]
            };
        }
        const user = await User.findOne(query);
        
        if (user) {
            let message = "تمت الموافقة وفك الحظر";
            if (user.pendingPassword) {
                const hashedPassword = await bcrypt.hash(user.pendingPassword, 10);
                user.password = hashedPassword;
                user.plainPassword = user.pendingPassword;
                user.pendingPassword = undefined;
                message = "تمت الموافقة وتحديث كلمة المرور وفك الحظر";
            }
            // Also reset locks upon password change approval
            user.loginAttempts = 0;
            user.lockCount = 0;
            user.lockUntil = null;
            user.isLockedBySystem = false;
            await user.save();
            
            // Just in case, ensure company is active
            if (companyId) {
               await Company.updateOne({ id: companyId }, { $set: { approved: true, subscriptionExpired: false } });
            }
            return res.json({ message });
        }
        return res.status(404).json({ message: "لا يوجد طلب تحديث معلق لهذا الحساب" });
      } catch (e) {
        console.error("Mongoose approve error:", e);
      }
    }

    // Fallback to local storage
    const users = getUsers();
    const dataObj = getData();
    let user = null;
    
    if (userId) {
       user = users.find((u: any) => u.id === userId);
    } else {
       user = users.find((u: any) => u.companyId === companyId && (u.pendingPassword || u.isLockedBySystem || u.lockUntil));
    }
    
    if (user) {
        let message = "تمت الموافقة وفك الحظر";
        if (user.pendingPassword) {
            const hashedPassword = await bcrypt.hash(user.pendingPassword, 10);
            user.password = hashedPassword;
            user.plainPassword = user.pendingPassword;
            delete user.pendingPassword;
            message = "تمت الموافقة وتحديث كلمة المرور وفك الحظر";
        }
        user.loginAttempts = 0;
        user.lockCount = 0;
        user.lockUntil = null;
        user.isLockedBySystem = false;
        saveUsers(users);

        if (companyId && dataObj.companies) {
            const companyIndex = dataObj.companies.findIndex((c: any) => c.id === companyId);
            if (companyIndex !== -1) {
                dataObj.companies[companyIndex].approved = true;
                dataObj.companies[companyIndex].subscriptionExpired = false;
                saveData(dataObj);
            }
        }
        return res.json({ message });
    }
    
    res.status(404).json({ message: "لا يوجد طلب تحديث معلق" });
  });

  app.post("/api/force-update-password", async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ message: "يرجى توفير البريد وكلمة المرور الجديدة" });

    const emailLower = email.toLowerCase().trim();
    const dbConnected = await connectDB();
    if (dbConnected) {
      try {
        const User = collectionModelMap['users'];
        const user = await User.findOne({ email: emailLower });
        if (!user) return res.status(404).json({ message: "الحساب غير موجود" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // If super admin, update immediateley, otherwise set pending
        if (emailLower === "mustfadd112@gmail.com") {
            user.password = hashedPassword;
            user.plainPassword = newPassword;
            user.pendingPassword = undefined;
            await user.save();
            return res.json({ message: "تم تحديث الرمز السري للمشرف بنجاح" });
        } else {
            user.pendingPassword = newPassword;
            await user.save();
            // Unapprove the company
            const Company = collectionModelMap['companies'];
            await Company.updateOne({ id: user.companyId }, { $set: { approved: false } });
            return res.json({ message: "Password updated successfully in DB" });
        }
      } catch (e) {
        console.error("Mongoose reset error, trying fallback:", e);
      }
    }

    // Fallback to local storage users
    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.email === emailLower);
    if (userIndex !== -1) {
      try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // If super admin, update immediateley, otherwise set pending
        if (emailLower === "mustfadd112@gmail.com") {
            users[userIndex].password = hashedPassword;
            users[userIndex].plainPassword = newPassword;
            delete users[userIndex].pendingPassword;
            saveUsers(users);
             return res.json({ message: "تم تحديث الرمز السري للمشرف بنجاح" });
        } else {
            users[userIndex].pendingPassword = newPassword;
            saveUsers(users);
             // Unapprove the company
            const companyId = users[userIndex].companyId;
            if (companyId) {
                const dataObj = getData();
                if (dataObj.companies) {
                    const companyIndex = dataObj.companies.findIndex((c: any) => c.id === companyId);
                    if (companyIndex !== -1) {
                        dataObj.companies[companyIndex].approved = false;
                        saveData(dataObj);
                    }
                }
            }
            return res.json({ message: "Password updated successfully in Local Storage" });
        }
      } catch (err) {
        return res.status(500).json({ error: err });
      }
    }

    res.status(404).json({ message: "الحساب غير موجود" });
  });
  app.post("/api/register", async (req, res) => {
    const { email, password, fullName, companyName, companyHandle, phoneNumber } = req.body;
    if (!email || !password || !fullName || !companyName || !companyHandle) return res.status(400).json({ message: "يرجى ملء جميع الحقول المطلوبة" });

    const dbConnected = await connectDB();
    if (dbConnected) {
      try {
        const User = collectionModelMap['users'];
        const Company = collectionModelMap['companies'];
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        const existingCompany = await Company.findOne({ handle: companyHandle.toLowerCase().replace(/\s+/g, '_') });
        
        if (existingUser) {
           return res.status(400).json({ message: "الحساب موجود بالفعل" });
        }
        if (existingCompany) {
           return res.status(400).json({ message: "معرف الشركة موجود بالفعل" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newCompany = new Company({
            name: companyName,
            handle: companyHandle.toLowerCase().replace(/\s+/g, '_'),
            adminEmail: email.toLowerCase(),
            phoneNumber: phoneNumber || "",
            approved: false,
            subscriptionExpired: true,
            createdAt: new Date()
        });
        await newCompany.save();

        const newUser = new User({
          email: email.toLowerCase(),
          password: hashedPassword,
          fullName: fullName,
          phoneNumber: phoneNumber || "",
          plainPassword: password,
          role: email.toLowerCase() === 'mustfadd112@gmail.com' ? 'super_admin' : 'admin',
          companyId: newCompany.id, // Link user to company
          subscriptionDuration: "شهر واحد",
          subscriptionEndDate: calculateSubscriptionEndDate("شهر واحد"),
          loginAttempts: 0,
          lockUntil: null,
          isLockedBySystem: false,
          createdAt: new Date()
        });
        await newUser.save();
        
        return res.status(201).json({ message: "تم تسجيل الشركة بنجاح! بانتظار موافقة الإدارة (Admin) للبدء." });
      } catch (e) {
        console.error('MongoDB register error, falling back:', e);
      }
    }
    
    // Fallback to local storage (db.json and users.json)
    try {
      const users = getUsers();
      const existingUser = users.find((u: any) => u.email === email.toLowerCase());
      const dataObj = getData();
      if (!dataObj.companies) dataObj.companies = [];
      const existingCompany = dataObj.companies.find((c: any) => c.handle === companyHandle.toLowerCase().replace(/\s+/g, '_'));

      if (existingUser) {
        return res.status(400).json({ message: "الحساب موجود بالفعل" });
      }
      if (existingCompany) {
        return res.status(400).json({ message: "معرف الشركة موجود بالفعل" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const companyId = Date.now().toString();
      
      const newCompany = {
        id: companyId,
        name: companyName,
        handle: companyHandle.toLowerCase().replace(/\s+/g, '_'),
        adminEmail: email.toLowerCase(),
        phoneNumber: phoneNumber || "",
        approved: false,
        subscriptionExpired: true,
        createdAt: new Date().toISOString()
      };
      dataObj.companies.push(newCompany);
      saveData(dataObj);

      const newUser = {
        id: Date.now().toString(),
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName: fullName,
        phoneNumber: phoneNumber || "",
        plainPassword: password,
        role: email.toLowerCase() === 'mustfadd112@gmail.com' ? 'super_admin' : 'admin',
        companyId: companyId,
        subscriptionDuration: "شهر واحد",
        subscriptionEndDate: calculateSubscriptionEndDate("شهر واحد"),
        loginAttempts: 0,
        lockUntil: null,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      saveUsers(users);

      return res.status(201).json({ message: "تم تسجيل الشركة بنجاح! بانتظار موافقة الإدارة (Admin) للبدء." });
    } catch (e) {
      console.error('Local Register error:', e);
      return res.status(500).json({ message: "حدث خطأ أثناء إنشاء الحساب محلياً" });
    }
  });

  const calculateSubscriptionEndDate = (duration: string) => {
    const now = new Date();
    if (duration === 'شهر واحد') now.setMonth(now.getMonth() + 1);
    else if (duration === '3 أشهر') now.setMonth(now.getMonth() + 3);
    else if (duration === '6 أشهر') now.setMonth(now.getMonth() + 6);
    else if (duration === 'سنة') now.setFullYear(now.getFullYear() + 1);
    else now.setMonth(now.getMonth() + 1); // Default 1 month
    return now;
  };

  
  app.post("/api/register-branch", authenticateToken, async (req: any, res: any) => {
    const { email, password, branchName, companyId: reqCompanyId } = req.body;
    if (!email || !password || !branchName) return res.status(400).json({ message: "يرجى ملء جميع الحقول المطلوبة" });

    // Only main company account or super_admin can create a branch
    const isSuperAdmin = req.user?.role === 'super_admin' || req.user?.role === 'superadmin' || req.user?.email === 'mustfadd112@gmail.com';
    
    if (!isSuperAdmin && (req.user?.branchId || (req.user?.role !== 'admin' && req.user?.role !== 'user'))) {
        return res.status(403).json({ message: "صلاحيات غير كافية لإنشاء فرع" });
    }

    const companyId = isSuperAdmin ? reqCompanyId : (req.user.companyId || req.user.id);
    if (!companyId) return res.status(400).json({ message: "يرجى توفير معرف الشركة" });

    const dbConnected = await connectDB();
    if (dbConnected) {
      try {
        const User = collectionModelMap['users'];
        const Company = collectionModelMap['companies'];
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        
        if (existingUser) {
           return res.status(400).json({ message: "الحساب موجود بالفعل" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const branchId = Date.now().toString();
        
        const newBranchUser = new User({
            id: branchId,
            email: email.toLowerCase(),
            password: hashedPassword,
            plainPassword: password, // As requested for reference, or remove
            fullName: branchName,
            role: 'branch',
            companyId: companyId,
            branchId: branchId,
            isBanned: false,
            subscriptionExpired: true,
            createdAt: new Date()
        });
        await newBranchUser.save();

        // Also add to company branches array
        await Company.updateOne(
            { id: companyId },
            { $push: { branches: { id: branchId, name: branchName, email: email.toLowerCase() } } }
        );

        res.json({ message: "تم إنشاء الفرع بنجاح", branchId: branchId });
      } catch (e) {
        console.error(e);
        res.status(500).json({ message: "خطأ داخلي في الخادم" });
      }
    } else {
        res.status(500).json({ message: "Database not connected" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "يرجى توفير البريد وكلمة المرور" });

    const emailLower = email.toLowerCase().trim();
    const dbConnected = await connectDB();

    // Helper to send successful login response
    const sendSuccess = (user: any, companyName: string, companyHandle: string) => {
      const token = jwt.sign({ id: user.id || user.uid, email: user.email, role: user.role, companyId: user.companyId, branchId: user.branchId }, JWT_SECRET, { expiresIn: '24h' });
      res.json({
        message: "تم تسجيل الدخول بنجاح",
        token,
        user: {
          id: user.id || user.uid,
          uid: user.id || user.uid,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          companyId: user.companyId,
          companyName,
          companyHandle,
          branchId: user.branchId
        }
      });
    };

    if (dbConnected) {
      try {
        const User = collectionModelMap['users'];
        const user = await User.findOne({ email: emailLower });

        if (user) {
          if (user.isBanned) {
             return res.status(403).json({ message: "تم حظر هذا الحساب نهائياً من قبل الإدارة الفنية." });
          }
          if (user.isLockedBySystem) {
            return res.status(403).json({ message: "تم تعطيل حسابك لتكرار المحاولات الخاطئة. يرجى التواصل مع إدارة النظام للتفعيل." });
          }
          if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
            const remainingMins = Math.ceil((new Date(user.lockUntil).getTime() - new Date().getTime()) / 60000);
            let timeMsg = `${remainingMins} دقيقة`;
            if (remainingMins === 1) timeMsg = "دقيقة واحدة";
            if (remainingMins === 2) timeMsg = "دقيقتين";
            return res.status(429).json({ 
              message: `الحساب محظور مؤقتاً. حاول بعد ${timeMsg}.`,
              lockUntil: user.lockUntil 
            });
          }

          let isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch && (user.password === password || user.plainPassword === password)) {
            isMatch = true;
            user.password = await bcrypt.hash(password, 10);
          }

          if (isMatch) {
            // Successful MongoDB login
            user.loginAttempts = 0;
            user.lockUntil = null;
            user.isLockedBySystem = false;
            if (!user.plainPassword) user.plainPassword = password;
            
            // Auto super admin
            if (emailLower === 'mustfadd112@gmail.com') {
              user.role = 'super_admin';
            }
            await user.save();

            let companyHandle = "";
            let companyName = "";
            const isSuperAdmin = user.role === 'super_admin' || user.role === 'superadmin' || user.email === 'mustfadd112@gmail.com';

            if (user.companyId) {
              const Company = collectionModelMap['companies'];
              const comp = await Company.findOne({ id: user.companyId });
              if (comp) {
                companyHandle = comp.handle || "";
                companyName = comp.name || "";
                if (!isSuperAdmin) {
                  if (user.role === 'branch') {
                    if (user.subscriptionExpired || (user.subscriptionEndDate && new Date() > new Date(user.subscriptionEndDate))) {
                      if (user.subscriptionEndDate && new Date() > new Date(user.subscriptionEndDate)) {
                        user.subscriptionExpired = true;
                        await user.save();
                      }
                      return res.status(403).json({ message: "انتهى اشتراك الفرع الخاص بك. يرجى المراجعة." });
                    }
                  } else {
                    if (!comp.approved) return res.status(403).json({ message: "الحساب قيد المراجعة حالياً. يرجى الانتظار لحين الموافقة." });
                    if (comp.subscriptionExpired || (comp.subscriptionEndDate && new Date() > new Date(comp.subscriptionEndDate))) {
                      if (comp.subscriptionEndDate && new Date() > new Date(comp.subscriptionEndDate)) {
                        comp.subscriptionExpired = true;
                        await comp.save();
                      }
                      return res.status(403).json({ message: "انتهى اشتراكك الشهري. يرجى المراجعة." });
                    }
                  }
                }
              }
            }
            return sendSuccess(user, companyName, companyHandle);
          } else {
            // Fail MongoDB login
            const currentAttempts = (user.loginAttempts || 0) + 1;
            user.loginAttempts = currentAttempts;
            await user.save();
            
            if (currentAttempts >= 5) {
              user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
              user.isLockedBySystem = currentAttempts >= 6; // Permanent lock on 6th
              await user.save();
              
              if (user.isLockedBySystem) {
                return res.status(403).json({ message: "تم تعطيل حسابك لتكرار المحاولات الخاطئة. يرجى التواصل مع الإدارة لفك القفل." });
              }
              
              return res.status(429).json({ 
                message: "تم حظر الحساب مؤقتاً لمدة 15 دقيقة بسبب 5 محاولات خاطئة. المحاولة القادمة ستؤدي للقفل الدائم.",
                lockUntil: user.lockUntil
              });
            }

            const attemptsLeft = 5 - currentAttempts;
            return res.status(401).json({ message: `خطأ في كلمة المرور. لديك ${attemptsLeft > 0 ? attemptsLeft : 0} محاولات متبقية قبل حظر الحساب.` });
          }
        }
      } catch (e) {
        console.error('MongoDB login error:', e);
      }
    }

    // Fallback or No Match in MongoDB
    const users = getUsers();
    const user = users.find((u: any) => u.email === emailLower);

    if (user) {
      if (user.isBanned) return res.status(403).json({ message: "تم حظر هذا الحساب نهائياً من قبل الإدارة الفنية." });
      if (user.isLockedBySystem) return res.status(403).json({ message: "تم تعطيل حسابك لتكرار المحاولات الخاطئة. يرجى التواصل مع إدارة النظام للتفعيل." });
      
      if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
        const remainingMins = Math.ceil((new Date(user.lockUntil).getTime() - new Date().getTime()) / 60000);
        let timeMsg = `${remainingMins} دقيقة`;
        if (remainingMins === 1) timeMsg = "دقيقة واحدة";
        if (remainingMins === 2) timeMsg = "دقيقتين";
        return res.status(429).json({ 
          message: `الحساب محظور مؤقتاً. حاول بعد ${timeMsg}.`,
          lockUntil: user.lockUntil
        });
      }

      let isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch && (user.password === password || user.plainPassword === password)) isMatch = true;

      if (isMatch) {
        // Reset fallback attempts
        user.loginAttempts = 0;
        user.lockUntil = null;
        user.isLockedBySystem = false;
        saveUsers(users);

        let companyHandle = "";
        let companyName = "";
        const dataObj = getData();
        const isSuperAdmin = user.role === 'super_admin' || user.role === 'superadmin' || user.email === 'mustfadd112@gmail.com';

        if (user.companyId && dataObj.companies) {
          const comp = dataObj.companies.find((c: any) => c.id === user.companyId);
          if (comp) {
            companyHandle = comp.handle || "";
            companyName = comp.name || "";
            if (!isSuperAdmin) {
              if (user.role === 'branch') {
                if (user.subscriptionExpired) {
                  return res.status(403).json({ message: "انتهى اشتراك الفرع الخاص بك" });
                }
              } else {
                if (!comp.approved || comp.subscriptionExpired) {
                  return res.status(403).json({ message: "الحساب غير نشط أو انتهى الاشتراك" });
                }
              }
            }
          }
        }
        return sendSuccess(user, companyName, companyHandle);
      } else {
        // Fail fallback login
        const currentAttempts = (user.loginAttempts || 0) + 1;
        user.loginAttempts = currentAttempts;
        
        if (currentAttempts >= 5) {
          user.lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          user.isLockedBySystem = currentAttempts >= 6;
          saveUsers(users);
          
          if (user.isLockedBySystem) {
            return res.status(403).json({ message: "تم تعطيل حسابك لتكرار المحاولات الخاطئة. يرجى التواصل مع الإدارة لفك القفل." });
          }
          
          return res.status(429).json({ 
            message: "تم حظر الحساب مؤقتاً لمدة 15 دقيقة بسبب 5 محاولات خاطئة. المحاولة القادمة ستؤدي للقفل الدائم.",
            lockUntil: user.lockUntil
          });
        }

        saveUsers(users);
        const attemptsLeft = 5 - currentAttempts;
        return res.status(401).json({ message: `خطأ في كلمة المرور. لديك ${attemptsLeft > 0 ? attemptsLeft : 0} محاولات متبقية قبل حظر الحساب.` });
      }
    }

    res.status(401).json({ message: "خطأ في البريد الإلكتروني أو كلمة المرور" });
  });

  app.post("/api/admin/update-role", authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'super_admin' && req.user.email !== 'mustfadd112@gmail.com') return res.sendStatus(403);
    const { email, newRole } = req.body;
    if (!email || !newRole) return res.status(400).json({ message: "يرجى توفير البريد والرتبة الجديدة" });

    const emailLower = email.toLowerCase().trim();
    const dbConnected = await connectDB();
    if (dbConnected) {
      try {
        const User = collectionModelMap['users'];
        const user = await User.findOneAndUpdate({ email: emailLower }, { role: newRole });
        if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
        return res.json({ message: "تم تحديث الرتبة بنجاح" });
      } catch (e: any) {
        return res.status(500).json({ message: "حدث خطأ" });
      }
    }
    return res.status(500).json({ message: "Database connection failed" });
  });

  app.post("/api/admin/unblock-company", authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'super_admin' && req.user.email !== 'mustfadd112@gmail.com') return res.sendStatus(403);
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ message: "Company ID required" });

    const dbConnected = await connectDB();
    if (dbConnected) {
      try {
        const User = collectionModelMap['users'];
        await User.updateMany({ companyId: companyId }, { 
          lockUntil: null, 
          loginAttempts: 0, 
          isLockedBySystem: false 
        });
      } catch (e) {
        console.error("Mongoose unblock error:", e);
      }
    }

    const users = getUsers();
    let updated = false;
    users.forEach((u: any) => {
      if (u.companyId === companyId) {
        u.lockUntil = null;
        u.loginAttempts = 0;
        u.isLockedBySystem = false;
        updated = true;
      }
    });
    if (updated) saveUsers(users);

    res.json({ message: "تم فك الحظر المؤقت بنجاح" });
  });

  app.post("/api/admin/toggle-ban-company", authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'super_admin' && req.user.email !== 'mustfadd112@gmail.com') return res.sendStatus(403);
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ message: "Company ID required" });

    const dbConnected = await connectDB();
    let newState = false;
    if (dbConnected) {
      try {
        const Company = collectionModelMap['companies'];
        const User = collectionModelMap['users'];
        const company = await Company.findOne({ id: companyId });
        if (company) {
          newState = !company.isBanned;
          company.isBanned = newState;
          await company.save();
          await User.updateMany({ companyId: companyId }, { isBanned: newState });
        }
      } catch (e) {
        console.error("Mongoose toggle-ban error:", e);
      }
    }

    const users = getUsers();
    let updated = false;
    users.forEach((u: any) => {
      if (u.companyId === companyId) {
        u.isBanned = newState;
        updated = true;
      }
    });

    // Also update company in db.json if exists
    if (fs.existsSync(DATA_FILE)) {
      try {
        const dbData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
        if (dbData.companies) {
          const compIndex = dbData.companies.findIndex((c: any) => c.id === companyId);
          if (compIndex !== -1) {
            dbData.companies[compIndex].isBanned = newState;
            newState = dbData.companies[compIndex].isBanned;
            fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2));
          }
        }
      } catch (e) {}
    }

    if (updated) saveUsers(users);

    res.json({ message: newState ? "تم حظر الشركة نهائياً" : "تم إلغاء الحظر النهائي عن الشركة", isBanned: newState });
  });

  app.post("/api/user/heartbeat", authenticateToken, async (req: any, res: any) => {
    const userId = req.user?.id;
    const email = req.user?.email?.toLowerCase().trim();
    if (!userId && !email) return res.sendStatus(401);

    const now = new Date().toISOString();

    const dbConnected = await connectDB();
    if (dbConnected) {
      try {
        const User = collectionModelMap['users'];
        await User.findOneAndUpdate({ email: email }, { lastSeen: now });
      } catch (e) {
        console.error("Mongoose heartbeat error:", e);
      }
    }

    // Update local storage/memory fallback
    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.email === email || u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].lastSeen = now;
      saveUsers(users);
    }

    res.sendStatus(200);
  });

  // --- Generic Data Endpoints ---

  const syncIdentityHelper = async (body: any, userId?: string) => {
    const idNumber = body.idNumber || body.id_number || "";
    const fullName = body.fullName || body.full_name || body.name || "";
    if (!idNumber && !fullName) return;
    
    try {
      const dbConnected = await connectDB();
      if (dbConnected) {
        const Identity = collectionModelMap['identities'];
        if (Identity) {
          const query = idNumber 
            ? { idNumber: idNumber, ...(userId ? { userId } : {}) } 
            : { fullName: fullName, ...(userId ? { userId } : {}) };
          await Identity.findOneAndUpdate(
            query,
            {
              fullName: fullName || undefined,
              idNumber: idNumber || undefined,
              userId: userId || undefined,
              scannedAt: new Date()
            },
            { upsert: true, new: true }
          );
          console.log("Successfully synced Identity in MongoDB:", { fullName, idNumber, userId });
        }
      } else {
        // Fallback local file system db.json
        const data = getData();
        if (!data.identities) data.identities = [];
        const index = data.identities.findIndex((i: any) => 
          ((idNumber && i.idNumber === idNumber) || (fullName && i.fullName === fullName)) &&
          (!userId || i.userId === userId)
        );
        if (index !== -1) {
          data.identities[index] = {
            ...data.identities[index],
            fullName: fullName || data.identities[index].fullName,
            idNumber: idNumber || data.identities[index].idNumber,
            userId: userId || data.identities[index].userId,
            scannedAt: new Date().toISOString()
          };
        } else {
          data.identities.push({
            id: Date.now().toString(),
            fullName,
            idNumber,
            userId,
            scannedAt: new Date().toISOString()
          });
        }
        saveData(data);
        console.log("Successfully synced Identity in local storage:", { fullName, idNumber, userId });
      }
    } catch (e) {
      console.error("Error in syncIdentityHelper:", e);
    }
  };

  app.get("/api/data/:collection", authenticateToken, async (req: any, res: any) => {
    const { collection } = req.params;
    const Model = collectionModelMap[collection];
    const isGlobal = collection === 'companies' || collection === 'users' || collection === 'external_blocklist' || collection === 'blocklist';
    const userId = req.user?.id;
    
    if (Model) {
      try {
        const dbConnected = await connectDB();
        if (dbConnected) {
          let ownerData: any = {};
          if (!isGlobal && req.user?.role !== 'superadmin' && req.user?.role !== 'super_admin') {
              if (req.user?.branchId && collection !== 'debts' && collection !== 'contracts') ownerData.branchId = req.user.branchId;
          }
          const filter = { 
            ...req.query, 
            ...ownerData
          };
          const results = await Model.find(filter);
          return res.json(results);
        }
      } catch (e) {
        console.error('MongoDB query error:', e);
      }
    }

    const data = getData();
    const list = data[collection] || [];
    
    // Simple filter support
    let result = [...list];
    if (!isGlobal && userId) {
      result = result.filter(item => item.userId === userId);
    }
    Object.keys(req.query).forEach(key => {
      const val = req.query[key];
      if (val !== undefined) {
        result = result.filter(item => String(item[key]) === String(val));
      }
    });

    res.json(result);
  });

  app.get("/api/data/:collection/:id", authenticateToken, async (req: any, res: any) => {
    const { collection, id } = req.params;
    const Model = collectionModelMap[collection];
    const isGlobal = collection === 'companies' || collection === 'users' || collection === 'external_blocklist' || collection === 'blocklist';
    const userId = req.user?.id;
    
    if (Model) {
      try {
        const dbConnected = await connectDB();
        if (dbConnected) {
          const filter: any = { 
            id: id, 
            ...(isGlobal ? {} : { userId: userId }) 
          };
          
          if (!isGlobal && req.user?.role !== 'superadmin' && req.user?.role !== 'super_admin') {
            filter.companyId = req.user?.companyId || req.user?.id;
            if (req.user?.branchId && collection !== 'debts') filter.branchId = req.user.branchId;
          }
          
          const mongoItem = await Model.findOne(mongoose.Types.ObjectId.isValid(id) ? { $or: [{id: id}, {_id: id}] } : { id: id });
          
          if (mongoItem) {
             // Ownership check
             if (!isGlobal && userId && mongoItem.userId !== userId && mongoItem.companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {
                return res.status(403).json({ message: "غير مسموح لك بالوصول إلى هذا العنصر" });
             }
             return res.json(mongoItem);
          }
        }
      } catch (e) {
        console.error('MongoDB getOne error:', e);
      }
    }

    const data = getData();
    const list = data[collection] || [];
    const item = list.find((i: any) => i.id === id);

    console.log(`[GET /api/data/${collection}/${id}] local item:`, !!item);
    if (!item) return res.status(404).json({ message: "العنصر غير موجود" });

    if (!isGlobal && userId && item.userId !== userId && item.companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: "غير مسموح لك بالوصول إلى هذا العنصر" });
    }

    res.json(item);
  });

  app.post("/api/data/:collection", authenticateToken, async (req: any, res: any) => {
    const { collection } = req.params;
    
    // START: Simplified chassis handling for inventory
    if (collection === 'inventory') {
        // Just ensure consistency without strict length validation
        const chassisNumber = req.body.chassisNumber || req.body.chassis || req.body.chassis_number;
        req.body.chassisNumber = chassisNumber;
        req.body.chassis = chassisNumber;
        req.body.chassis_number = chassisNumber;
    }
    // END: Simplified chassis handling

    const Model = collectionModelMap[collection];
    const isGlobal = collection === 'companies' || collection === 'users' || collection === 'external_blocklist' || collection === 'blocklist';
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    let ownerData: any = {};
    if (!isGlobal && req.user?.role !== 'superadmin' && req.user?.role !== 'super_admin') {
        ownerData = { companyId: companyId || userId };
        if (req.user?.branchId && collection !== 'debts' && collection !== 'contracts') ownerData.branchId = req.user.branchId;
    }

    const itemData = {
      ...req.body,
      ...ownerData
    };

    if (Model) {
      try {
        const dbConnected = await connectDB();
        if (dbConnected) {
          const dataForMongo = { ...itemData, id: Date.now().toString() };
          if (dataForMongo._id) {
            delete dataForMongo._id;
          }
          const newItem = new Model(dataForMongo);
          await newItem.save();
          if (collection === 'blocklist') {
              console.log("Adding blocklist notification for user:", req.user?.id, "company:", req.user?.companyId);
              try {
                const noteData = {
                    companyId: req.user?.companyId,
                    userId: req.user?.id,
                    message: `تم إضافة ${req.body.name || req.body.fullName || 'شخص'} إلى قائمة الحظر.`,
                    type: 'alert'
                };
                console.log("Creating notification with data:", JSON.stringify(noteData));
                const note = await collectionModelMap['notifications'].create(noteData);
                console.log("Notification created successfully:", JSON.stringify(note));
              } catch (err) {
                console.error("Error creating notification:", err);
              }
          }
          return res.status(201).json(newItem);
        }
      } catch (e) {
        console.error('MongoDB post error:', e);
      }
    }

    const data = getData();
    if (!data[collection]) data[collection] = [];
    
    const newItem = {
      id: Date.now().toString(),
      ...itemData,
      createdAt: itemData.createdAt || new Date().toISOString()
    };

    data[collection].push(newItem);
    saveData(data);
    res.status(201).json(newItem);
  });

  app.put("/api/data/:collection/:id", authenticateToken, async (req: any, res: any) => {
    const { collection, id } = req.params;
    const Model = collectionModelMap[collection];
    const isGlobal = collection === 'companies' || collection === 'users' || collection === 'external_blocklist' || collection === 'blocklist';
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    // Auto sync identity changes if fields exist
    if (collection === 'customers' || collection === 'blocklist' || collection === 'identities') {
      await syncIdentityHelper(req.body, userId);
    }

    if (collection === 'inventory') {
        const chassisNumber = req.body.chassisNumber || req.body.chassis || req.body.chassis_number;
        req.body.chassisNumber = chassisNumber;
        req.body.chassis = chassisNumber;
        req.body.chassis_number = chassisNumber;
    }

    let ownerData: any = {};
    if (!isGlobal && req.user?.role !== 'superadmin' && req.user?.role !== 'super_admin') {
        ownerData = { companyId: companyId || userId };
        if (req.user?.branchId && collection !== 'debts' && collection !== 'contracts') ownerData.branchId = req.user.branchId;
    }

    const itemData = {
      ...req.body,
      ...ownerData
    };

    if (Model) {
      try {
        const dbConnected = await connectDB();
        if (dbConnected) {
          const filter = {
            id: id,
            ...(isGlobal ? {} : ownerData)
          };
          const updatedItem = await Model.findOneAndUpdate(filter, itemData, { new: true, upsert: true });
          return res.json(updatedItem);
        }
      } catch (e) {
        console.error('MongoDB put error:', e);
      }
    }

    const data = getData();
    const list = data[collection] || [];
    const index = list.findIndex((i: any) => i.id === id);
    
    if (index === -1) {
      const newItem = {
        id,
        ...itemData,
        updatedAt: new Date().toISOString()
      };
      if (!data[collection]) data[collection] = [];
      data[collection].push(newItem);
      saveData(data);
      return res.json(newItem);
    }

    // Verify ownership
    if (!isGlobal && userId && list[index].userId !== userId && list[index].companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: "غير مسموح لك بتعديل هذا العنصر" });
    }
    data[collection][index] = {
      ...data[collection][index],
      ...itemData,
      updatedAt: new Date().toISOString()
    };

    saveData(data);
    res.json(data[collection][index]);
  });

  app.delete("/api/data/:collection/:id", authenticateToken, async (req: any, res: any) => {
    const { collection, id } = req.params;
    const userId = req.user?.uid;
    console.log('Delete request. Collection:', collection, 'User Role:', req.user?.role);
    if (collection === 'blocklist' && req.user.role !== 'super_admin' && req.user.email?.toLowerCase() !== 'mustfadd112@gmail.com') {
        return res.status(403).json({ message: "ليس لديك صلاحية لإلغاء التعميم" });
    }
    const Model = collectionModelMap[collection];
    const isGlobal = collection === 'companies' || collection === 'users' || collection === 'external_blocklist' || collection === 'blocklist';
    
    console.log('Delete request. Collection:', collection, 'ID:', id);

    if (Model) {
      try {
        const dbConnected = await connectDB();
        if (dbConnected) {
          const filter: any = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id: id }, { _id: id }] } : { id: id };
          const deletedItem = await Model.findOneAndDelete(filter);
          console.log('MongoDB deletedItem:', deletedItem);

          if (deletedItem) return res.json({ message: "تم الحذف بنجاح" });
          else console.log('Not found in MongoDB, falling back to local JSON...');
        }
      } catch (e) {
        console.error('MongoDB delete error:', e);
        return res.status(500).json({ message: "خطأ في السيرفر", error: e });
      }
    }

    const data = getData();
    if (!data[collection]) return res.sendStatus(404);
    
    const item = data[collection].find((i: any) => i.id === id);
    if (!item) return res.sendStatus(404);
    if (!isGlobal && userId && item.userId !== userId && item.companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: "غير مسموح لك بحذف هذا العنصر" });
    }

    data[collection] = data[collection].filter((i: any) => i.id !== id);
    saveData(data);
    res.json({ message: "تم الحذف بنجاح" });
  });

  app.post("/delete-car", authenticateToken, async (req: any, res: any) => {
    try {
      const carId = req.body.id;
      const collection = 'inventory'; 
      const Model = collectionModelMap[collection];

      if (!Model) {
        return res.status(404).json({ success: false, message: "النموذج غير موجود" });
      }

      const dbConnected = await connectDB();
      if (!dbConnected) {
         return res.status(500).json({ success: false, message: "فشل الاتصال بقاعدة البيانات" });
      }

      console.log('Attempting to delete car from DB with ID:', carId, 'type:', typeof carId);
      const result = await Model.deleteOne({ id: String(carId) });
      const result2 = await Model.deleteOne({ id: Number(carId) });
      
      console.log('Delete result:', result, result2);

      // تأكد أن النتيجة تعبر عن عدم العثور على العنصر
      if (result.deletedCount === 0 && result2.deletedCount === 0) {
        console.log('No item deleted in DB');
        // Return 200 and success true to trigger frontend UI update
        return res.json({ success: true, message: "تم حذف السيارة" });
      }

      res.json({
        success: true,
        message: "تم حذف السيارة من الأسطول"
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: (err as any).message
      });
    }
  });

  // Specific query for staff profile by UID (Firebase compatibility)
  app.get("/api/staff/:uid", async (req, res) => {
    const { uid } = req.params;
    const Model = collectionModelMap['staff'];
    if (Model) {
      try {
        const dbConnected = await connectDB();
        if (dbConnected) {
          const staff = await Model.findOne(mongoose.Types.ObjectId.isValid(uid) ? { $or: [{ id: uid }, { userId: uid }, { _id: uid }] } : { $or: [{ id: uid }, { userId: uid }] });
          if (staff) return res.json(staff);
        }
      } catch (e) {
        console.error('MongoDB staff lookup error:', e);
      }
    }

    const data = getData();
    const staff = (data.staff || []).find((s: any) => s.id === uid || s.userId === uid);
    if (!staff) return res.status(404).json({ message: "الموظف غير موجود" });
    res.json(staff);
  });

  // Catch-all for API routes to avoid SPA fallback returning HTML
  app.all("/api/*", (req, res) => {
    res.status(404).json({ message: `API Route Not Found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Initialize Telegram Concealed Bot
  initConcealedBot(io);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
