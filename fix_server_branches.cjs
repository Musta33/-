const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Add register-branch endpoint
const registerBranchCode = `
  app.post("/api/register-branch", authenticateToken, async (req, res) => {
    const { email, password, branchName } = req.body;
    if (!email || !password || !branchName) return res.status(400).json({ message: "يرجى ملء جميع الحقول المطلوبة" });

    // Only main company account can create a branch
    if (req.user?.branchId || (req.user?.role !== 'admin' && req.user?.role !== 'user')) {
        return res.status(403).json({ message: "صلاحيات غير كافية لإنشاء فرع" });
    }

    const companyId = req.user.companyId || req.user.id;

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
`;

if (!code.includes('/api/register-branch')) {
  code = code.replace('app.post("/api/login"', registerBranchCode + '\n  app.post("/api/login"');
}

// Modify JWT signing to include branchId
code = code.replace(
  /const token = jwt.sign\({ id: user.id \|\| user.uid, email: user.email, role: user.role, companyId: user.companyId \}/g,
  "const token = jwt.sign({ id: user.id || user.uid, email: user.email, role: user.role, companyId: user.companyId, branchId: user.branchId })"
);

// Include branchId in user response
code = code.replace(
  /companyHandle/g,
  "companyHandle,\n          branchId: user.branchId"
);

// In GET /api/data/:collection, add branchId filter if not global
const getFilterRegex = /let ownerData = \{\};\s*const filter = \{/g;
code = code.replace(getFilterRegex, `let ownerData: any = {};
          if (!isGlobal && req.user?.role !== 'superadmin' && req.user?.role !== 'super_admin') {
              if (req.user?.branchId) ownerData.branchId = req.user.branchId;
          }
          const filter = {`);

// In GET /api/data/:collection/:id
const getOneFilterRegex = /if \(\!isGlobal && req\.user\?\.role \!\=\= 'superadmin' && req\.user\?\.role \!\=\= 'super_admin'\) \{\s*filter\.companyId = req\.user\?\.companyId \|\| req\.user\?\.id;\s*\}/g;
code = code.replace(getOneFilterRegex, `if (!isGlobal && req.user?.role !== 'superadmin' && req.user?.role !== 'super_admin') {
            filter.companyId = req.user?.companyId || req.user?.id;
            if (req.user?.branchId) filter.branchId = req.user.branchId;
          }`);

// In POST and PUT /api/data/:collection
const postOwnerRegex = /if \(\!isGlobal && req\.user\?\.role \!\=\= 'superadmin' && req\.user\?\.role \!\=\= 'super_admin'\) \{\s*ownerData = \{ companyId: companyId \|\| userId \};\s*\}/g;
code = code.replace(postOwnerRegex, `if (!isGlobal && req.user?.role !== 'superadmin' && req.user?.role !== 'super_admin') {
        ownerData = { companyId: companyId || userId };
        if (req.user?.branchId) ownerData.branchId = req.user.branchId;
    }`);

fs.writeFileSync('server.ts', code);
