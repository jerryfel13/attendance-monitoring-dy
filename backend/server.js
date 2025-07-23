const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const subjectsRoutes = require('./routes/subjects');
const sessionsRoutes = require('./routes/sessions');
const studentsRoutes = require('./routes/students');
const recordsRoutes = require('./routes/records');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration - Very permissive for development
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://v0-attendance-system-design-eight.vercel.app',
  'https://attendance-system-design-eight.vercel.app',
  'https://v0-attendance-system-design-eight.vercel.app/auth/register',
  'https://*.vercel.app',
  'https://*.railway.app',
  'https://railway.com',
  process.env.FRONTEND_URL
].filter(Boolean);
 
console.log('🚀 Starting server with CORS configuration...');
console.log('📋 Allowed origins:', allowedOrigins);
console.log('🌐 FRONTEND_URL:', process.env.FRONTEND_URL);

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    console.log('🔍 CORS check for origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ Allowing request with no origin');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ Origin allowed:', origin);
      return callback(null, true);
    }
    
    // Check for wildcard matches
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        const regex = new RegExp(pattern);
        const matches = regex.test(origin);
        console.log(`🔍 Wildcard check: ${allowed} -> ${origin} = ${matches}`);
        return matches;
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      console.log('✅ Origin allowed via wildcard:', origin);
      return callback(null, true);
    }
    
    console.log('❌ CORS blocked origin:', origin);
    console.log('📋 Allowed origins:', allowedOrigins);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Add preflight handler
app.options('*', cors());

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Attendance API is running',
    cors: {
      allowedOrigins: allowedOrigins,
      frontendUrl: process.env.FRONTEND_URL,
      currentOrigin: req.headers.origin
    }
  });
});

// Root route for testing
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Root route working',
    time: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/student', studentsRoutes);
app.use('/api/records', recordsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      error: 'CORS error', 
      message: 'Origin not allowed',
      origin: req.headers.origin,
      allowedOrigins: allowedOrigins
    });
  }
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Allowed origins:`, allowedOrigins);
  console.log(`📱 Frontend URL:`, process.env.FRONTEND_URL);
}); 