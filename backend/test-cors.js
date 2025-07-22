// Test CORS configuration
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4001;

// Test CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://v0-attendance-system-design-eight.vercel.app',
  'https://*.vercel.app',
  'https://*.railway.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      return callback(null, true);
    }
    
    console.log('CORS blocked:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

app.options('*', cors());

app.get('/test', (req, res) => {
  res.json({ 
    message: 'CORS test successful',
    origin: req.headers.origin,
    allowedOrigins: allowedOrigins
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Test URL: http://localhost:${PORT}/test`);
}); 