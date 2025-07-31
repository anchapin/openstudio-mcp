#!/usr/bin/env ruby

begin
  require 'openstudio'
  puts "✓ openstudio gem loaded successfully"
rescue LoadError => e
  puts "✗ Failed to load openstudio gem: #{e.message}"
  exit 1
end

begin
  require 'openstudio-standards'
  puts "✓ openstudio-standards gem loaded successfully"
rescue LoadError => e
  puts "✗ Failed to load openstudio-standards gem: #{e.message}"
  exit 1
end

# Create a simple model
model = OpenStudio::Model::Model.new
puts "✓ Created OpenStudio model"

# Try to create a simple building
building = model.getBuilding
building.setName("Test Building")
puts "✓ Created building: #{building.name}"

# Save the model
model.save('/tmp/test_model.osm', true)
puts "✓ Model saved to /tmp/test_model.osm"

puts "Ruby version: #{RUBY_VERSION}"
puts "OpenStudio version: #{OpenStudio.openStudioVersion}"