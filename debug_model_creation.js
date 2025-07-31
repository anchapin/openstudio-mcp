const { executeOpenStudioCommand } = require('./dist/utils/commandExecutor');
const fileOperations = require('./dist/utils/fileOperations').default;
const config = require('./dist/config').default;

async function testModelCreation() {
  console.log('Testing model creation...');
  
  // Create a simple Ruby script
  const scriptContent = `
require 'openstudio'
require 'openstudio-standards'

puts "Starting model creation..."

# Create a new model
model = OpenStudio::Model::Model.new

# Set up building
building = model.getBuilding
building.setName('Test Office Building')

puts "Created building: #{building.name}"

# Save the model
output_path = '/tmp/debug_test_model.osm'
begin
  model.save(output_path, true)
  puts "Model saved to #{output_path}"
  puts "File size: #{File.size(output_path)} bytes" if File.exist?(output_path)
rescue => e
  puts "Error saving model: #{e.message}"
  exit 1
end
`;

  try {
    console.log('Creating temporary script file...');
    const scriptPath = await fileOperations.createTempFile(scriptContent, { 
      tempDir: config.tempDir
    });
    console.log('Script path:', scriptPath);
    
    console.log('Executing OpenStudio command...');
    const result = await executeOpenStudioCommand('execute_ruby_script', [scriptPath]);
    console.log('Result:', result);
    
    console.log('Cleaning up...');
    await fileOperations.deleteFile(scriptPath);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testModelCreation();