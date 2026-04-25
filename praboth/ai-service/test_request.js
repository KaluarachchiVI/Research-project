const http = require('http');

const testData = JSON.stringify({
  data: {
    text: 'Writing code in VS Code'
  }
});

const options = {
  hostname: '127.0.0.1',
  port: 3400,
  path: '/categorizeContext',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:');
    console.log(data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(testData);
req.end();
