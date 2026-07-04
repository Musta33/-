const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const newContentCode = `
            {currentTab === 'employees' && (
              <Employees 
                key={\`emp-\${currentTab}\`}
                myCompany={myCompany} 
                staff={user} 
              />
            )}
`;

content = content.replace(
    `            {/* TAB: MAINTENANCE */}`,
    `            {/* TAB: MAINTENANCE */}
${newContentCode}`
);

fs.writeFileSync('src/App.tsx', content);
