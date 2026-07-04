async function run() {
  const loginRes = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mustfadd112@gmail.com', password: 'unknown' })
  });
  console.log('Login:', loginRes.status, await loginRes.text());
}
run();
