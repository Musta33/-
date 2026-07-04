async function test() {
  try {
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mustfadd112@gmail.com', password: 'unknown' }) 
    });
    // Wait, the password is '123456' from the log I saw!
    const loginRes2 = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mustfadd112@gmail.com', password: '123456' }) 
    });
    const loginData = await loginRes2.json();
    console.log("Logged in:", loginData.token ? "YES" : "NO");

    if (loginData.token) {
        const res = await fetch(`http://localhost:3000/api/data/companies/${loginData.user.companyId || 'dummy'}`, {
          headers: { 'Authorization': `Bearer ${loginData.token}` }
        });
        const d = await res.text();
        console.log("COMPANY STATUS:", res.status, "DATA:", d);
    }
  } catch(e) { console.error('CRASH:', e); }
}
test();
