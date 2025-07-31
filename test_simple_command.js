const { executeOpenStudioCommand } = require('./dist/utils/commandExecutor');

async function testCommand() {
  console.log('Testing OpenStudio version command...');
  
  try {
    const result = await executeOpenStudioCommand('--version');
    console.log('Version result:', result);
  } catch (error) {
    console.error('Version error:', error);
  }
  
  console.log('Testing execute_ruby_script with simple script...');
  
  try {
    const result = await executeOpenStudioCommand('execute_ruby_script', ['test_simple_model.rb']);
    console.log('Script result:', result);
  } catch (error) {
    console.error('Script error:', error);
  }
}

testCommand();