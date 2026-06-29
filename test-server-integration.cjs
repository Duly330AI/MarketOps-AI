const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'server.ts'], { stdio: 'pipe' });

server.stdout.on('data', (data) => {
  console.log(`SERVER OUT: ${data}`);
  if (data.toString().includes('running on port')) {
    fetch('http://localhost:3000/api/state')
      .then(r => r.json())
      .then(d => {
         console.log("API RETURNED:", JSON.stringify(d.assets[0], null, 2));
         server.kill();
         process.exit(0);
      });
  }
});

server.stderr.on('data', (data) => {
  console.error(`SERVER ERR: ${data}`);
});
