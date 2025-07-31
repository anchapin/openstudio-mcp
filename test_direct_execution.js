const { executeCommand } = require('./dist/utils/commandExecutor');

async function testDirectExecution() {
  console.log('Testing direct OpenStudio execution...');
  
  try {
    const result = await executeCommand('/Applications/OpenStudio-3.10.0/bin/openstudio', ['--version'], {
      timeout: 10000,
      captureStdout: true,
      captureStderr: true,
    });
    
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirectExecution();