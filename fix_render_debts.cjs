const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const customersRender = `              {currentTab === 'customers' && (
                <Customers user={user} />
              )}`;

const debtsRender = `              {currentTab === 'debts' && (
                <Debts user={user} />
              )}
              {currentTab === 'customers' && (
                <Customers user={user} />
              )}`;

code = code.replace(customersRender, debtsRender);

fs.writeFileSync('src/App.tsx', code);
