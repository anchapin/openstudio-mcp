const { spawn } = require('child_process');

console.log('Testing simple spawn...');

const child = spawn('/Applications/OpenStudio-3.10.0/bin/openstudio', ['--version']);

let output = '';
let error = '';

child.stdout.on('data', (data) => {
  output += data.toString();
});

child.stderr.on('data', (data) => {
  error += data.toString();
});

child.on('close', (code) => {
  console.log('Exit code:', code);
  console.log('Output:', output);
  console.log('Error:', error);
  process.exit(0);
});

child.on('error', (err) => {
  console.log('Spawn error:', err);
  process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('Timeout - killing process');
  child.kill();
  process.exit(1);
}, 5000);