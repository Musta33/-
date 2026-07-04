fetch("http://localhost:3000/api/data/companies/nonexistent").then(res => res.text()).then(t => console.log('RES', t)).catch(console.error);
