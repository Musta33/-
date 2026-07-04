const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Find the GET handler for /api/data/:collection/:id
const startStr = 'app.get("/api/data/:collection/:id"';
let startIndex = content.indexOf(startStr);
let endIndex = content.indexOf('app.post("/api/data/:collection"', startIndex);

if(startIndex > -1 && endIndex > -1) {
  let original = content.substring(startIndex, endIndex);
  let replacement = `app.get("/api/data/:collection/:id", authenticateToken, async (req: any, res: any) => {
    const { collection, id } = req.params;
    const Model = collectionModelMap[collection];
    const isGlobal = collection === 'companies' || collection === 'users' || collection === 'external_blocklist' || collection === 'blocklist';
    const userId = req.user?.id;
    
    if (Model) {
      try {
        const dbConnected = await connectDB();
        if (dbConnected) {
          const filter = { 
            id: id, 
            ...(isGlobal ? {} : { userId: userId }) 
          };
          
          if (!isGlobal && req.user?.role !== 'superadmin' && req.user?.role !== 'super_admin') {
            filter.companyId = req.user?.companyId || req.user?.id;
          }
          
          const mongoItem = await Model.findOne({ $or: [{id: id}, {_id: id}] });
          
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

    console.log(\`[GET /api/data/\${collection}/\${id}] local item:\`, !!item);
    if (!item) return res.status(404).json({ message: "العنصر غير موجود" });

    if (!isGlobal && userId && item.userId !== userId && item.companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: "غير مسموح لك بالوصول إلى هذا العنصر" });
    }

    res.json(item);
  });

  `;
  content = content.replace(original, replacement);
  fs.writeFileSync('server.ts', content);
  console.log('Fixed syntax error');
}
