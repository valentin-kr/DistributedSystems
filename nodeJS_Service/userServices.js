const http = require('http');

const PORT = process.env.PORT || 3000;

const users = [
  { id: 1, username: 'sinem' },
  { id: 2, username: 'reyhan' },
  { id: 3, username: 'valentin' },
];

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(users));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`userServices listening on port ${PORT}`);
});
