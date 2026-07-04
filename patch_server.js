const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `                if (!isSuperAdmin) {
                  if (!comp.approved) return res.status(403).json({ message: "الحساب قيد المراجعة حالياً. يرجى الانتظار لحين الموافقة." });
                  if (comp.subscriptionExpired || (comp.subscriptionEndDate && new Date() > new Date(comp.subscriptionEndDate))) {
                    if (comp.subscriptionEndDate && new Date() > new Date(comp.subscriptionEndDate)) {
                      comp.subscriptionExpired = true;
                      await comp.save();
                    }
                    return res.status(403).json({ message: "انتهى اشتراكك الشهري. يرجى المراجعة." });
                  }
                }`,
  `                if (!isSuperAdmin) {
                  if (user.role === 'branch') {
                     // Independent subscription for branches
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
                }`
);

fs.writeFileSync('server.ts', code);
