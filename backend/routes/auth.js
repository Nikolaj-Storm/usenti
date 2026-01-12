const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          name: name || email.split('@')[0]
        }
      }
    });

    if (error) throw error;

    res.json({ 
      success: true, 
      user: data.user, 
      session: data.session 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });

    if (error) throw error;

    res.json({ 
      success: true, 
      session: data.session, 
      user: data.user 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      await supabase.auth.signOut(token);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ success: true }); // Return success anyway
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) throw error;
    
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: error.message });
  }
});

module.exports = router;
