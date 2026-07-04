// fetch from localhost
fetch('http://localhost:3000/api/data/companies/nonexistent', {
  headers: {
    'Authorization': 'Bearer null'
  }
}).then(r=>r.text()).then(console.log).catch(console.error);
