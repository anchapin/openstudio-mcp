/**
 * Tests for model templates functionality
 */
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import fs from 'fs';
import { modelTemplates } from '../src/utils';
import { executeOpenStudioCommand } from '../src/utils/commandExecutor';
import { fileOperations } from '../src/utils';

// Mock the executeOpenStudioCommand function
const mockExecuteOpenStudioCommand = sinon.stub();

// Create a sandbox for sinon stubs
const sandbox = sinon.createSandbox();

describe('Model Templates', () => {
  beforeEach(() => {
    // Reset the sandbox before each test
    sandbox.restore();
    
    // Mock the executeOpenStudioCommand function
    sandbox.stub(require('../src/utils/commandExecutor'), 'executeOpenStudioCommand')
      .callsFake(mockExecuteOpenStudioCommand);
    
    // Mock file operations
    sandbox.stub(fileOperations, 'ensureDirectory').resolves();
    sandbox.stub(fileOperations, 'createTempFile').resolves('/tmp/temp-script.rb');
    sandbox.stub(fileOperations, 'deleteFile').resolves();
    
    // Mock fs.existsSync
    sandbox.stub(fs, 'existsSync').returns(true);
    
    // Reset the mock before each test
    mockExecuteOpenStudioCommand.reset();
    mockExecuteOpenStudioCommand.resolves({
      success: true,
      stdout: 'Model created successfully',
      stderr: '',
      error: null
    });
  });
  
  afterEach(() => {
    // Restore all stubs
    sandbox.restore();
  });
  
  describe('createModelFromTemplate', () => {
    it('should create an empty model', async () => {
      const result = await modelTemplates.createModelFromTemplate('empty', '/path/to/model.osm');
      
      expect(result.success).to.be.true;
      expect(mockExecuteOpenStudioCommand.calledOnce).to.be.true;
      expect(mockExecuteOpenStudioCommand.firstCall.args[0]).to.equal('create');
      expect(mockExecuteOpenStudioCommand.firstCall.args[1]).to.deep.equal(['--empty', '/path/to/model.osm']);
    });
    
    it('should create an office model with default options', async () => {
      const result = await modelTemplates.createModelFromTemplate('office', '/path/to/office.osm');
      
      expect(result.success).to.be.true;
      expect(mockExecuteOpenStudioCommand.calledOnce).to.be.true;
      expect(mockExecuteOpenStudioCommand.firstCall.args[0]).to.equal('ruby');
      expect(mockExecuteOpenStudioCommand.firstCall.args[1][0]).to.equal('/tmp/temp-script.rb');
      
      // Verify the script content was created with the right template type
      expect(fileOperations.createTempFile.calledOnce).to.be.true;
      const scriptContent = fileOperations.createTempFile.firstCall.args[0];
      expect(scriptContent).to.include("facility.add_building_type('MediumOffice'");
    });
    
    it('should create a residential model with custom options', async () => {
      const options = {
        buildingType: 'MidriseApartment',
        buildingVintage: '90.1-2016',
        climateZone: 'ASHRAE 169-2013-3A',
        floorArea: 2000,
        numStories: 5,
        aspectRatio: 2.0,
        floorToFloorHeight: 3.5,
        includeHVAC: false
      };
      
      const result = await modelTemplates.createModelFromTemplate('residential', '/path/to/residential.osm', options);
      
      expect(result.success).to.be.true;
      expect(mockExecuteOpenStudioCommand.calledOnce).to.be.true;
      expect(mockExecuteOpenStudioCommand.firstCall.args[0]).to.equal('ruby');
      
      // Verify the script content was created with the custom options
      expect(fileOperations.createTempFile.calledOnce).to.be.true;
      const scriptContent = fileOperations.createTempFile.firstCall.args[0];
      expect(scriptContent).to.include("facility.add_building_type('MidriseApartment'");
      expect(scriptContent).to.include("facility.add_building_vintage('90.1-2016'");
      expect(scriptContent).to.include("facility.add_climate_zone('ASHRAE 169-2013-3A'");
      expect(scriptContent).to.include("facility.set_value('total_floor_area', 2000");
      expect(scriptContent).to.include("facility.set_value('num_stories', 5");
      expect(scriptContent).to.include("facility.set_value('aspect_ratio', 2.0");
      expect(scriptContent).to.include("facility.set_value('floor_height', 3.5");
      expect(scriptContent).to.include("facility.set_value('add_hvac', false");
    });
    
    it('should handle errors gracefully', async () => {
      // Mock an error in the command execution
      mockExecuteOpenStudioCommand.rejects(new Error('Command failed'));
      
      const result = await modelTemplates.createModelFromTemplate('office', '/path/to/model.osm');
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Command failed');
    });
    
    it('should validate the output path', async () => {
      // Test with an invalid path
      const result = await modelTemplates.createModelFromTemplate('empty', '');
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid output path');
    });
  });
  
  describe('getAvailableTemplateTypes', () => {
    it('should return all available template types', () => {
      const types = modelTemplates.getAvailableTemplateTypes();
      
      expect(types).to.be.an('array');
      expect(types).to.include('empty');
      expect(types).to.include('office');
      expect(types).to.include('residential');
      expect(types).to.include('retail');
      expect(types).to.include('warehouse');
      expect(types).to.include('school');
      expect(types).to.include('hospital');
    });
  });
  
  describe('getAvailableBuildingTypes', () => {
    it('should return building types for office template', () => {
      const types = modelTemplates.getAvailableBuildingTypes('office');
      
      expect(types).to.be.an('array');
      expect(types).to.include('SmallOffice');
      expect(types).to.include('MediumOffice');
      expect(types).to.include('LargeOffice');
    });
    
    it('should return building types for residential template', () => {
      const types = modelTemplates.getAvailableBuildingTypes('residential');
      
      expect(types).to.be.an('array');
      expect(types).to.include('MidriseApartment');
      expect(types).to.include('HighriseApartment');
    });
    
    it('should return empty array for empty template', () => {
      const types = modelTemplates.getAvailableBuildingTypes('empty');
      
      expect(types).to.be.an('array');
      expect(types).to.be.empty;
    });
  });
});