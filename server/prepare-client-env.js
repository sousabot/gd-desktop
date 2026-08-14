const fs = require('fs');
const path = require('path');

const dest = path.join(__dirname, '..', 'client.env');
const src = path.join(__dirname, '..', 'client.env.example');
if (!fs.existsSync(dest)) {
  fs.copyFileSync(src, dest);
  console.log('[prepare-client-env] created client.env from example');
}
