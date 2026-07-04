async function test() {
  const loginRes = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mustfadd112@gmail.com', password: '123456' }) 
  });
  const data = await loginRes.json();
  console.log('User data:', data.user);
}
test();
