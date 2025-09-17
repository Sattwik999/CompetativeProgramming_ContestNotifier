// proxy_server.js
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
app.use(cors());

const SITES = {
  leetcode: 'https://leetcode.com/contest/',
  codechef: 'https://www.codechef.com/contests',
  codeforces: 'https://codeforces.com/api/contest.list?gym=false'
};

app.get('/:site', async (req, res) => {
  const url = SITES[req.params.site];
  if (!url) return res.status(404).send('Unknown site');
  try {
    const response = await fetch(url, { timeout: 10000 });
    if (!response.ok) return res.status(502).send('Upstream error');
    const data = req.params.site === 'codeforces' ? await response.json() : await response.text();
    res.set('Cache-Control', 'public, max-age=300'); // cache for 5 minutes
    res.send(data);
  } catch (e) {
    res.status(500).send('Error fetching ' + req.params.site + ': ' + e.message);
  }
});

app.get('/', (req, res) => res.send('Contest Proxy Server is running.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Contest proxy server running on port', PORT);
});
