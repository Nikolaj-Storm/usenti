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

    // CRITICAL FIX: Ensure user_profiles entry exists
    // The database trigger should create this, but as a fallback, we create it manually
    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          email: data.user.email, // Store email in user_profiles for convenience
          name: data.user.user_metadata?.name || name || email.split('@')[0], // Store user's name
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      // Ignore error if profile already exists (conflict)
      if (profileError && !profileError.message?.includes('duplicate')) {
        console.error('Warning: Could not create user profile:', profileError);
      } else {
        console.log('✅ User profile created for:', data.user.id);
      }
    }

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

    // CRITICAL FIX: Ensure user_profiles entry exists (for users who signed up before the fix)
    if (data.user) {
      // Check if profile exists
      const { data: profile, error: profileFetchError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      // If profile doesn't exist, create it
      if (profileFetchError && profileFetchError.code === 'PGRST116') {
        console.log('⚠️ User profile missing for:', data.user.id, '- creating now...');

        const { error: profileCreateError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: data.user.email, // Store email in user_profiles for convenience
            name: data.user.user_metadata?.name || data.user.email.split('@')[0], // Store user's name
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (profileCreateError) {
          console.error('❌ Failed to create user profile:', profileCreateError);
        } else {
          console.log('✅ User profile created for:', data.user.id);
        }
      }
    }

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

    // CRITICAL FIX: Ensure user_profiles entry exists
    if (user) {
      const { data: profile, error: profileFetchError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      // If profile doesn't exist, create it
      if (profileFetchError && profileFetchError.code === 'PGRST116') {
        console.log('⚠️ User profile missing for:', user.id, '- creating now...');

        const { error: profileCreateError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email, // Store email in user_profiles for convenience
            name: user.user_metadata?.name || user.email.split('@')[0], // Store user's name
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (profileCreateError && !profileCreateError.message?.includes('duplicate')) {
          console.error('❌ Failed to create user profile:', profileCreateError);
        } else {
          console.log('✅ User profile created for:', user.id);
        }
      }
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: error.message });
  }
});

module.exports = router;
