const fs = require('fs');
let content = fs.readFileSync('src/lib/api.ts', 'utf8');

content = content.replace(
  "    if (!response.ok) {\n      const text = await response.text().catch(() => 'Unknown Error');\n      throw new Error(text);\n    }",
  "    if (response.status === 404) return null;\n    if (!response.ok) {\n      const text = await response.text().catch(() => 'Unknown Error');\n      throw new Error(text);\n    }"
);

// We need to update getDoc and onSnapshot to handle null
content = content.replace(
  "        const item = await api.getOne(coll, id);\n        return {\n            id: item.id || item._id,\n            data: () => item,\n            exists: () => true\n        };",
  "        const item = await api.getOne(coll, id);\n        if (!item) return { id, data: () => null, exists: () => false };\n        return {\n            id: item.id || item._id,\n            data: () => item,\n            exists: () => true\n        };"
);

content = content.replace(
  "                const item = await api.getOne(q.coll, q.id);\n                callback({\n                    id: item.id || item._id,\n                    data: () => item,\n                    exists: () => true\n                });",
  "                const item = await api.getOne(q.coll, q.id);\n                if (!item) {\n                    callback({ id: q.id, data: () => null, exists: () => false });\n                } else {\n                    callback({\n                        id: item.id || item._id,\n                        data: () => item,\n                        exists: () => true\n                    });\n                }"
);


fs.writeFileSync('src/lib/api.ts', content);
console.log('Fixed api.ts');
