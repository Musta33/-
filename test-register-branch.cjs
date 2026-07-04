fetch('http://127.0.0.1:3000/api/register-branch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email: 'test', password: 'test', branchName: 'test' })
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
}).catch(console.error);
