import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";

// Local Storage Setup
const USERS_FILE = path.join(process.cwd(), "users.json");
const DATA_FILE = path.join(process.cwd(), "db.json");

const getUsers = () => {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
};

const saveUsers = (users: any) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

const getData = () => {
  if (!fs.existsSync(DATA_FILE)) {
    return {
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
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (e) {
    return {};
  }
};

const saveData = (data: any) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "iraq_rental_local_secret_key_123";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' })); // Allow higher limit for base64 images

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", backend: "local-file-system" });
  });

  // --- Gemini ID Extraction ---
  app.post("/api/extract-id", async (req, res) => {
    const { base64ImageBytes, mimeType } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "لم يتم تكوين مفتاح الذكاء الاصطناعي على السيرفر." });
    }

    if (!base64ImageBytes || !mimeType) {
      return res.status(400).json({ error: "بيانات الصورة غير مكتملة" });
    }

    const genAI = new GoogleGenAI({ apiKey });
    const model = (genAI as any).getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `استخرج المعلومات التالية من بطاقة الهوية / بطاقة السكن هذه:
1. الاسم الكامل (Full Name)
2. رقم بطاقة الهوية الوطنية أو رقم الإقامة (ID Number أو Residency Card Number)

قم بإرجاع النتيجة بصيغة JSON.`;

    try {
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: base64ImageBytes.split(",")[1] || base64ImageBytes, mimeType } }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING },
              idNumber: { type: Type.STRING }
            },
            required: ["fullName", "idNumber"]
          }
        }
      });

      const response = await result.response;
      res.json(JSON.parse(response.text()));
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message || "فشل في قراءة الصورة" });
    }
  });

  // --- Local Auth Routes ---

  app.post("/api/register", async (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password) return res.status(400).json({ message: "يرجى ملء الحقول المطلوبة" });

    const users = getUsers();
    if (users.find((u: any) => u.email === email.toLowerCase())) {
      return res.status(400).json({ message: "الحساب موجود بالفعل" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName: fullName || email.split('@')[0],
      role: email.toLowerCase() === 'mustfadd112@gmail.com' ? 'super_admin' : 'staff',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    res.status(201).json({ message: "تم إنشاء الحساب بنجاح" });
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const users = getUsers();
    const user = users.find((u: any) => u.email === email.toLowerCase());

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      message: "تم تسجيل الدخول بنجاح",
      token,
      user: {
        id: user.id,
        uid: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  });

  // --- Generic Data Endpoints ---

  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  app.get("/api/data/:collection", (req, res) => {
    const { collection } = req.params;
    const data = getData();
    const list = data[collection] || [];
    
    // Simple filter support
    let result = [...list];
    Object.keys(req.query).forEach(key => {
      const val = req.query[key];
      if (val !== undefined) {
        result = result.filter(item => String(item[key]) === String(val));
      }
    });

    res.json(result);
  });

  app.get("/api/data/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const data = getData();
    const list = data[collection] || [];
    const item = list.find((i: any) => i.id === id);
    if (!item) return res.status(404).json({ message: "العنصر غير موجود" });
    res.json(item);
  });

  app.post("/api/data/:collection", (req, res) => {
    const { collection } = req.params;
    const data = getData();
    if (!data[collection]) data[collection] = [];
    
    const newItem = {
      id: Date.now().toString(),
      ...req.body,
      createdAt: req.body.createdAt || new Date().toISOString()
    };

    data[collection].push(newItem);
    saveData(data);
    res.status(201).json(newItem);
  });

  app.put("/api/data/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const data = getData();
    const list = data[collection] || [];
    const index = list.findIndex((i: any) => i.id === id);
    
    if (index === -1) {
      // If not found, we can either 404 or create (like setDoc)
      const newItem = {
        id,
        ...req.body,
        updatedAt: new Date().toISOString()
      };
      if (!data[collection]) data[collection] = [];
      data[collection].push(newItem);
      saveData(data);
      return res.json(newItem);
    }

    data[collection][index] = {
      ...data[collection][index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    saveData(data);
    res.json(data[collection][index]);
  });

  app.delete("/api/data/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const data = getData();
    if (!data[collection]) return res.sendStatus(404);
    
    const initialLength = data[collection].length;
    data[collection] = data[collection].filter((i: any) => i.id !== id);
    
    if (data[collection].length === initialLength) return res.sendStatus(404);
    
    saveData(data);
    res.json({ message: "تم الحذف بنجاح" });
  });

  // Specific query for staff profile by UID (Firebase compatibility)
  app.get("/api/staff/:uid", (req, res) => {
    const { uid } = req.params;
    const data = getData();
    const staff = (data.staff || []).find((s: any) => s.id === uid || s.userId === uid);
    if (!staff) return res.status(404).json({ message: "الموظف غير موجود" });
    res.json(staff);
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
