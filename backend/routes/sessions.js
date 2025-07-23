const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Handle route-based requests
router.put('/', async (req, res) => {
  const { route } = req.query;
  
  if (route === 'stop') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing session id' });
    }
    try {
      const result = await pool.query(
        'UPDATE attendance_sessions SET is_active = false WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({ message: 'Session stopped successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to stop session', details: err.message });
    }
  } else {
    res.status(400).json({ error: 'Invalid route' });
  }
});

// Stop attendance session
router.put('/stop', async (req, res) => {
  const { id } = req.query;
  try {
    const result = await pool.query(
      'UPDATE attendance_sessions SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({ message: 'Session stopped successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop session', details: err.message });
  }
});

module.exports = router; 