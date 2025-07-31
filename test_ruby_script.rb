require 'openstudio'
require 'openstudio-standards'

# Create a new model
model = OpenStudio::Model::Model.new

# Set up building
building = model.getBuilding
building.setName('MediumOffice')

# Calculate dimensions based on floor area and aspect ratio
total_floor_area = 1000
num_stories = 3
aspect_ratio = 1.5
floor_height = 3

# Calculate floor area per story
floor_area_per_story = total_floor_area / num_stories

# Calculate building dimensions
# area = length * width, aspect_ratio = length / width
# So: area = aspect_ratio * width^2, therefore width = sqrt(area / aspect_ratio)
width = Math.sqrt(floor_area_per_story / aspect_ratio)
length = width * aspect_ratio

puts "Creating building: #{length.round(2)}m x #{width.round(2)}m x #{num_stories} stories"

# Create spaces for each story
(0...num_stories).each do |story|
  story_name = "Story_#{story + 1}"
  
  # Create thermal zone for this story
  zone = OpenStudio::Model::ThermalZone.new(model)
  zone.setName("#{story_name}_Zone")
  
  # Create space
  space = OpenStudio::Model::Space.new(model)
  space.setName("#{story_name}_Space")
  space.setThermalZone(zone)
  
  # Set space origin (z-coordinate for the story)
  origin = OpenStudio::Point3d.new(0, 0, story * floor_height)
  space.setXOrigin(origin.x)
  space.setYOrigin(origin.y)
  space.setZOrigin(origin.z)
  
  # Create floor vertices
  floor_vertices = []
  floor_vertices << OpenStudio::Point3d.new(0, 0, story * floor_height)
  floor_vertices << OpenStudio::Point3d.new(length, 0, story * floor_height)
  floor_vertices << OpenStudio::Point3d.new(length, width, story * floor_height)
  floor_vertices << OpenStudio::Point3d.new(0, width, story * floor_height)
  
  # Create floor surface
  floor = OpenStudio::Model::Surface.new(floor_vertices, model)
  floor.setName("#{story_name}_Floor")
  floor.setSurfaceType("Floor")
  floor.setSpace(space)
  
  # Create ceiling vertices
  ceiling_z = (story + 1) * floor_height
  ceiling_vertices = []
  ceiling_vertices << OpenStudio::Point3d.new(0, 0, ceiling_z)
  ceiling_vertices << OpenStudio::Point3d.new(0, width, ceiling_z)
  ceiling_vertices << OpenStudio::Point3d.new(length, width, ceiling_z)
  ceiling_vertices << OpenStudio::Point3d.new(length, 0, ceiling_z)
  
  # Create ceiling surface
  ceiling = OpenStudio::Model::Surface.new(ceiling_vertices, model)
  ceiling.setName("#{story_name}_Ceiling")
  ceiling.setSurfaceType("RoofCeiling")
  ceiling.setSpace(space)
end

puts "Created #{num_stories} stories with total floor area of #{total_floor_area} m²"

# Save the model
begin
  model.save('/tmp/test_ruby_script_model.osm', true)
  puts "Model created successfully and saved to #{File.absolute_path('/tmp/test_ruby_script_model.osm')}."
  puts "Model contains #{model.getSpaces.size} spaces and #{model.getSurfaces.size} surfaces."
rescue => e
  puts "Error saving model: #{e.message}"
  exit 1
end