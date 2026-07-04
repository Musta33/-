import http from 'http';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "iraq_rental_local_secret_key_123";
const token = jwt.sign({ id: 'test_user', email: 'mustfadd112@gmail.com', role: 'super_admin', companyId: '1779328182865' }, JWT_SECRET, { expiresIn: '24h' });

http.get('http://127.0.0.1:3000/api/data/companies/1779328182865', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body:', data));
}).on('error', (err) => {
  console.log('Error:', err.message);
});
