const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/data/companies/hello',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'DATA:', data));
});
req.on('error', e => console.error('ERROR:', e.message));
req.end();
