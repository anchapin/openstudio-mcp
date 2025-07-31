#!/usr/bin/env ruby

require 'openstudio'
require 'openstudio-standards'

# Create a new model
model = OpenStudio::Model::Model.new

# Create a simple building using the standard approach
building = model.getBuilding
building.setName("Office Building")

# Create a simple space
space = OpenStudio::Model::Space.new(model)
space.setName("Office Space")

# Create a thermal zone
zone = OpenStudio::Model::ThermalZone.new(model)
zone.setName("Office Zone")
space.setThermalZone(zone)

# Create a simple geometry (10m x 10m x 3m)
vertices = []
vertices << OpenStudio::Point3d.new(0, 0, 0)
vertices << OpenStudio::Point3d.new(10, 0, 0)
vertices << OpenStudio::Point3d.new(10, 10, 0)
vertices << OpenStudio::Point3d.new(0, 10, 0)

# Create floor surface
floor = OpenStudio::Model::Surface.new(vertices, model)
floor.setName("Floor")
floor.setSurfaceType("Floor")
floor.setSpace(space)

# Create walls
wall_height = 3.0

# South wall
south_vertices = []
south_vertices << OpenStudio::Point3d.new(0, 0, 0)
south_vertices << OpenStudio::Point3d.new(0, 0, wall_height)
south_vertices << OpenStudio::Point3d.new(10, 0, wall_height)
south_vertices << OpenStudio::Point3d.new(10, 0, 0)

south_wall = OpenStudio::Model::Surface.new(south_vertices, model)
south_wall.setName("South Wall")
south_wall.setSurfaceType("Wall")
south_wall.setSpace(space)

# East wall
east_vertices = []
east_vertices << OpenStudio::Point3d.new(10, 0, 0)
east_vertices << OpenStudio::Point3d.new(10, 0, wall_height)
east_vertices << OpenStudio::Point3d.new(10, 10, wall_height)
east_vertices << OpenStudio::Point3d.new(10, 10, 0)

east_wall = OpenStudio::Model::Surface.new(east_vertices, model)
east_wall.setName("East Wall")
east_wall.setSurfaceType("Wall")
east_wall.setSpace(space)

# North wall
north_vertices = []
north_vertices << OpenStudio::Point3d.new(10, 10, 0)
north_vertices << OpenStudio::Point3d.new(10, 10, wall_height)
north_vertices << OpenStudio::Point3d.new(0, 10, wall_height)
north_vertices << OpenStudio::Point3d.new(0, 10, 0)

north_wall = OpenStudio::Model::Surface.new(north_vertices, model)
north_wall.setName("North Wall")
north_wall.setSurfaceType("Wall")
north_wall.setSpace(space)

# West wall
west_vertices = []
west_vertices << OpenStudio::Point3d.new(0, 10, 0)
west_vertices << OpenStudio::Point3d.new(0, 10, wall_height)
west_vertices << OpenStudio::Point3d.new(0, 0, wall_height)
west_vertices << OpenStudio::Point3d.new(0, 0, 0)

west_wall = OpenStudio::Model::Surface.new(west_vertices, model)
west_wall.setName("West Wall")
west_wall.setSurfaceType("Wall")
west_wall.setSpace(space)

# Create ceiling
ceiling_vertices = []
ceiling_vertices << OpenStudio::Point3d.new(0, 0, wall_height)
ceiling_vertices << OpenStudio::Point3d.new(0, 10, wall_height)
ceiling_vertices << OpenStudio::Point3d.new(10, 10, wall_height)
ceiling_vertices << OpenStudio::Point3d.new(10, 0, wall_height)

ceiling = OpenStudio::Model::Surface.new(ceiling_vertices, model)
ceiling.setName("Ceiling")
ceiling.setSurfaceType("RoofCeiling")
ceiling.setSpace(space)

puts "✓ Created basic building geometry"

# Save the model
output_path = '/tmp/office_model.osm'
model.save(output_path, true)
puts "✓ Model saved to #{output_path}"

# Check if file was created
if File.exist?(output_path)
  puts "✓ File exists and is #{File.size(output_path)} bytes"
else
  puts "✗ File was not created"
end