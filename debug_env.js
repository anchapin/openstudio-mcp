const { spawn } = require('child_process');

console.log('Node.js PATH:', process.env.PATH);
console.log('Node.js PWD:', process.cwd());

// Test direct execution
const child = spawn('/Applications/OpenStudio-3.10.0/bin/openstudio', ['--version'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

child.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

child.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

child.on('close', (code) => {
  console.log('Exit code:', code);
});

child.on('error', (error) => {
  console.log('Error:', error);
});