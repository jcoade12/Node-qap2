const http = require('http');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const axios = require('axios');

// Custom event emitter
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

// Function to log events to both console and a daily log file
const logEvent = (message) => {
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  const date = new Date();
  const logFileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.log`;
  const logFile = path.join(logDir, logFileName);
  const logMessage = `${date.toISOString()} - ${message}\n`;

  fs.appendFile(logFile, logMessage, (err) => {
    if (err) throw err;
  });

  console.log(logMessage.trim());
};

// Set up event listeners
myEmitter.on('routeAccessed', (route) => {
  logEvent(`Route accessed: ${route}`);
});
myEmitter.on('fileRead', (filePath) => {
  logEvent(`File read successfully: ${filePath}`);
});
myEmitter.on('fileError', (filePath, error) => {
  logEvent(`Error reading file: ${filePath}. Error: ${error}`);
});

// Function to fetch daily information from an API
const getDailyInfo = async () => {
  try {
    const response = await axios.get('https://api.example.com/daily-info');
    return response.data;
  } catch (error) {
    return 'Unable to fetch daily information';
  }
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = req.url;
  myEmitter.emit('routeAccessed', url);

  if (url === '/daily-info') {
    const dailyInfo = await getDailyInfo();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body><h1>Daily Information</h1><p>${dailyInfo}</p></body></html>`);
  } else {
    // Serve HTML files for other routes
    let filePath = path.join(__dirname, 'views', url === '/' ? 'index.html' : `${url}.html`);
    const extname = path.extname(filePath);

    // Ensure only HTML files are served
    if (!extname) filePath += '.html';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          myEmitter.emit('fileError', filePath, 'File not found');
          fs.readFile(path.join(__dirname, 'views', '404.html'), (err, content) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end('Server Error', 'utf8');
              return;
            }
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content, 'utf8');
          });
        } else {
          myEmitter.emit('fileError', filePath, err.code);
          res.writeHead(500);
          res.end(`Server Error: ${err.code}`);
        }
      } else {
        myEmitter.emit('fileRead', filePath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content, 'utf8');
      }
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
