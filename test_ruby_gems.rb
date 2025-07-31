#!/usr/bin/env ruby

begin
  require 'openstudio'
  puts "✓ openstudio gem loaded successfully"
rescue LoadError => e
  puts "✗ Failed to load openstudio gem: #{e.message}"
  exit 1
end

begin
  require 'openstudio/model/version'
  puts "✓ openstudio/model/version loaded successfully"
rescue LoadError => e
  puts "✗ Failed to load openstudio/model/version: #{e.message}"
end

begin
  require 'openstudio/model_articulation/facility'
  puts "✓ openstudio/model_articulation/facility loaded successfully"
rescue LoadError => e
  puts "✗ Failed to load openstudio/model_articulation/facility: #{e.message}"
end

begin
  require 'openstudio/model_articulation/configurable_facility'
  puts "✓ openstudio/model_articulation/configurable_facility loaded successfully"
rescue LoadError => e
  puts "✗ Failed to load openstudio/model_articulation/configurable_facility: #{e.message}"
end

puts "Ruby version: #{RUBY_VERSION}"
puts "OpenStudio version: #{OpenStudio.openStudioVersion}" if defined?(OpenStudio)