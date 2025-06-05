const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = 3000;

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'todolist',
};

// Helper: Connect to DB
async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// Retrieve all items
async function retrieveListItems() {
  const connection = await getConnection();
  const [rows] = await connection.execute('SELECT id, text FROM items ORDER BY id ASC');
  await connection.end();
  return rows;
}

// Add new item
async function addItem(text) {
  const connection = await getConnection();
  const [result] = await connection.execute('INSERT INTO items (text) VALUES (?)', [text]);
  await connection.end();
  return result.insertId;
}

// Remove item by id
async function removeItem(id) {
  const connection = await getConnection();
  await connection.execute('DELETE FROM items WHERE id = ?', [id]);
  await connection.end();
}

// Update item text by id
async function updateItem(id, text) {
  const connection = await getConnection();
  await connection.execute('UPDATE items SET text = ? WHERE id = ?', [text, id]);
  await connection.end();
}

// Serve index.html
async function serveIndex(res) {
  try {
    const html = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch (err) {
    console.error('Error reading index.html:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

// Parse JSON body helper
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Main request handler
async function handleRequest(req, res) {
  if (req.method === 'GET' && req.url === '/') {
    await serveIndex(res);

  } else if (req.method === 'GET' && req.url === '/items') {
    try {
      const items = await retrieveListItems();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(items));
    } catch (err) {
      console.error('Error fetching items:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to retrieve items' }));
    }

  } else if (req.method === 'POST' && req.url === '/add') {
    try {
      const data = await parseRequestBody(req);
      if (!data.text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing text field' }));
        return;
      }
      const newId = await addItem(data.text);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id: newId }));
    } catch (err) {
      console.error('Error adding item:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to add item' }));
    }

  } else if (req.method === 'POST' && req.url === '/remove') {
    try {
      const data = await parseRequestBody(req);
      if (!data.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing id field' }));
        return;
      }
      await removeItem(data.id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      console.error('Error removing item:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to remove item' }));
    }

  } else if (req.method === 'POST' && req.url === '/edit') {
    try {
      const data = await parseRequestBody(req);
      if (!data.id || !data.text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing id or text field' }));
        return;
      }
      await updateItem(data.id, data.text);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      console.error('Error updating item:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to update item' }));
    }

  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Route not found');
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
