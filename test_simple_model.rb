#!/usr/bin/env ruby

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
output_path = '/tmp/test_simple_model.osm'
begin
  model.save(output_path, true)
  puts "Model saved to #{output_path}"
  puts "File size: #{File.size(output_path)} bytes" if File.exist?(output_path)
rescue => e
  puts "Error saving model: #{e.message}"
  exit 1
end