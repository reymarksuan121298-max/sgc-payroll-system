const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// MIDDLEWARE
app.use(cors()); // Pinapayagan ang React (port 5173) na mag-request dito
app.use(express.json()); // Para mabasa ang JSON data na pinapadala ng React

// SUPABASE CONNECTION
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// LOGIN ROUTE (Exercise: REST API Post Request)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  console.log(`Login attempt for: ${username}`); // Para makita mo sa terminal

  try {
    const { data, error } = await supabase
      .from('users') // Siguraduhin na may 'users' table ka sa Supabase
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: "Maling Username o Password" });
    }

    // Success! Ibalik ang user data sa React
    res.json({
      success: true,
      user: {
        id: data.id,
        username: data.username,
        role: data.role // kung may role column ka
      }
    });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// DEFAULT ROUTE
app.get('/', (req, res) => res.send('Payroll Backend is Running!'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});