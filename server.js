const express = require('express');
require('dotenv').config();
const supabase = require('./config/db');
const jwt = require('jsonwebtoken');
const auth = require('./middleware/auth');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

app.get('/test-db', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_current_timestamp');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error connecting to the database');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});