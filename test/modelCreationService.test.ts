/**
 * Tests for model creation service
 */
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import { ModelCreationService } from '../src/services/modelCreationService';
import { modelTemplates } from '../src/utils';

// Create a sandbox for sinon stubs
const sandbox = sinon.createSandbox();

describe('ModelCreationService', () => {
  let modelCreationService: ModelCreationService;
  
  beforeEach(() => {
    // Reset the sandbox before each test
    sandbox.restore();
    
    // Create a new instance of the service
    modelCreationService = new ModelCreationService();
    
    // Stub the modelTemplates.createModelFromTemplate method
    sandbox.stub(modelTemplates, 'createModelFromTemplate').resolves({
      success: true,
      output: 'Model created successfully',
      data: {
        modelPath: '/path/to/model.osm',
        templateType: 'office'
      }
    });
  });
  
  afterEach(() => {
    // Restore all stubs
    sandbox.restore();
  });
  
  describe('createModel', () => {
    it('should create a model with default options', async () => {
      const result = await modelCreationService.createModel({
        templateType: 'office',
        outputDirectory: '/path/to',
        modelName: 'model.osm'
      });
      
      expect(result.success).to.be.true;
      expect(result.modelPath).to.equal('/path/to/model.osm');
      expect(modelTemplates.createModelFromTemplate.calledOnce).to.be.true;
      expect(modelTemplates.createModelFromTemplate.firstCall.args[0]).to.equal('office');
      expect(modelTemplates.createModelFromTemplate.firstCall.args[1]).to.equal('/path/to/model.osm');
    });
    
    it('should create a model with custom template options', async () => {
      const templateOptions = {
        buildingType: 'LargeOffice',
        floorArea: 10000,
        numStories: 10
      };
      
      const result = await modelCreationService.createModel({
        templateType: 'office',
        templateOptions,
        outputDirectory: '/path/to',
        modelName: 'custom.osm'
      });
      
      expect(result.success).to.be.true;
      expect(result.modelPath).to.equal('/path/to/custom.osm');
      expect(modelTemplates.createModelFromTemplate.calledOnce).to.be.true;
      expect(modelTemplates.createModelFromTemplate.firstCall.args[0]).to.equal('office');
      expect(modelTemplates.createModelFromTemplate.firstCall.args[1]).to.equal('/path/to/custom.osm');
      expect(modelTemplates.createModelFromTemplate.firstCall.args[2]).to.deep.equal(templateOptions);
    });
    
    it('should handle errors from template creation', async () => {
      // Stub the createModelFromTemplate method to return an error
      (modelTemplates.createModelFromTemplate as sinon.SinonStub).resolves({
        success: false,
        output: '',
        error: 'Failed to create model'
      });
      
      const result = await modelCreationService.createModel({
        templateType: 'office',
        outputDirectory: '/path/to',
        modelName: 'model.osm'
      });
      
      expect(result.success).to.be.false;
      expect(result.error).to.equal('Failed to create model from template');
    });
    
    it('should handle exceptions', async () => {
      // Stub the createModelFromTemplate method to throw an error
      (modelTemplates.createModelFromTemplate as sinon.SinonStub).rejects(new Error('Unexpected error'));
      
      const result = await modelCreationService.createModel({
        templateType: 'office',
        outputDirectory: '/path/to',
        modelName: 'model.osm'
      });
      
      expect(result.success).to.be.false;
      expect(result.error).to.equal('Unexpected error');
    });
  });
  
  describe('getDefaultTemplateOptions', () => {
    it('should return default options for office template', () => {
      const options = modelCreationService.getDefaultTemplateOptions('office');
      
      expect(options).to.be.an('object');
      expect(options.buildingType).to.equal('MediumOffice');
      expect(options.buildingVintage).to.equal('90.1-2013');
      expect(options.floorArea).to.equal(5000);
      expect(options.numStories).to.equal(3);
    });
    
    it('should return default options for residential template', () => {
      const options = modelCreationService.getDefaultTemplateOptions('residential');
      
      expect(options).to.be.an('object');
      expect(options.buildingType).to.equal('MidriseApartment');
      expect(options.buildingVintage).to.equal('90.1-2013');
      expect(options.floorArea).to.equal(3000);
      expect(options.numStories).to.equal(4);
    });
    
    it('should return empty object for empty template', () => {
      const options = modelCreationService.getDefaultTemplateOptions('empty');
      
      expect(options).to.be.an('object');
      expect(Object.keys(options)).to.have.lengthOf(0);
    });
  });
  
  describe('getAvailableTemplateTypes', () => {
    it('should return all available template types', () => {
      // Stub the modelTemplates.getAvailableTemplateTypes method
      sandbox.stub(modelTemplates, 'getAvailableTemplateTypes').returns([
        'empty', 'office', 'residential', 'retail', 'warehouse', 'school', 'hospital'
      ]);
      
      const types = modelCreationService.getAvailableTemplateTypes();
      
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
      // Stub the modelTemplates.getAvailableBuildingTypes method
      sandbox.stub(modelTemplates, 'getAvailableBuildingTypes').returns([
        'SmallOffice', 'MediumOffice', 'LargeOffice'
      ]);
      
      const types = modelCreationService.getAvailableBuildingTypes('office');
      
      expect(types).to.be.an('array');
      expect(types).to.include('SmallOffice');
      expect(types).to.include('MediumOffice');
      expect(types).to.include('LargeOffice');
    });
  });
});