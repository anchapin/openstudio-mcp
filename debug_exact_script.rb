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
  
  # Create walls
  wall_height = floor_height
  
  # South wall (y=0)
  south_vertices = []
  south_vertices << OpenStudio::Point3d.new(0, 0, story * floor_height)
  south_vertices << OpenStudio::Point3d.new(0, 0, ceiling_z)
  south_vertices << OpenStudio::Point3d.new(length, 0, ceiling_z)
  south_vertices << OpenStudio::Point3d.new(length, 0, story * floor_height)
  
  south_wall = OpenStudio::Model::Surface.new(south_vertices, model)
  south_wall.setName("#{story_name}_South_Wall")
  south_wall.setSurfaceType("Wall")
  south_wall.setSpace(space)
  
  # East wall (x=length)
  east_vertices = []
  east_vertices << OpenStudio::Point3d.new(length, 0, story * floor_height)
  east_vertices << OpenStudio::Point3d.new(length, 0, ceiling_z)
  east_vertices << OpenStudio::Point3d.new(length, width, ceiling_z)
  east_vertices << OpenStudio::Point3d.new(length, width, story * floor_height)
  
  east_wall = OpenStudio::Model::Surface.new(east_vertices, model)
  east_wall.setName("#{story_name}_East_Wall")
  east_wall.setSurfaceType("Wall")
  east_wall.setSpace(space)
  
  # North wall (y=width)
  north_vertices = []
  north_vertices << OpenStudio::Point3d.new(length, width, story * floor_height)
  north_vertices << OpenStudio::Point3d.new(length, width, ceiling_z)
  north_vertices << OpenStudio::Point3d.new(0, width, ceiling_z)
  north_vertices << OpenStudio::Point3d.new(0, width, story * floor_height)
  
  north_wall = OpenStudio::Model::Surface.new(north_vertices, model)
  north_wall.setName("#{story_name}_North_Wall")
  north_wall.setSurfaceType("Wall")
  north_wall.setSpace(space)
  
  # West wall (x=0)
  west_vertices = []
  west_vertices << OpenStudio::Point3d.new(0, width, story * floor_height)
  west_vertices << OpenStudio::Point3d.new(0, width, ceiling_z)
  west_vertices << OpenStudio::Point3d.new(0, 0, ceiling_z)
  west_vertices << OpenStudio::Point3d.new(0, 0, story * floor_height)
  
  west_wall = OpenStudio::Model::Surface.new(west_vertices, model)
  west_wall.setName("#{story_name}_West_Wall")
  west_wall.setSurfaceType("Wall")
  west_wall.setSpace(space)
end

puts "Created #{num_stories} stories with total floor area of #{total_floor_area} m²"

# Save the model
begin
  model.save('/tmp/debug_exact_script_model.osm', true)
  puts "Model created successfully and saved to #{File.absolute_path('/tmp/debug_exact_script_model.osm')}."
  puts "Model contains #{model.getSpaces.size} spaces and #{model.getSurfaces.size} surfaces."
rescue => e
  puts "Error saving model: #{e.message}"
  exit 1
end