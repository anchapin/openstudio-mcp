/**
 * BCL Template Validation tests
 */
import { describe, it, expect } from 'vitest';
import { validateRequest, getValidationSchema } from '../src/utils/validation';

describe('BCL Template Validation', () => {
  describe('openstudio.bcl.template.search', () => {
    it('should validate a valid BCL template search request', () => {
      const request = {
        id: '123',
        type: 'openstudio.bcl.template.search',
        params: {
          buildingType: 'office',
          climateZone: 'ASHRAE 169-2013-5A',
          vintage: '90.1-2013',
          query: 'template',
          limit: 10,
        },
      };

      const result = validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate a BCL template search request with minimal parameters', () => {
      const request = {
        id: '123',
        type: 'openstudio.bcl.template.search',
        params: {},
      };

      const result = validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid limit values', () => {
      const request = {
        id: '123',
        type: 'openstudio.bcl.template.search',
        params: {
          limit: -5,
        },
      };

      const result = validateRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('openstudio.bcl.template.create', () => {
    it('should validate a valid BCL template create request', () => {
      const request = {
        id: '123',
        type: 'openstudio.bcl.template.create',
        params: {
          templateId: 'template-123',
          outputPath: '/path/to/model.osm',
          templateOptions: {
            buildingType: 'MediumOffice',
            buildingVintage: '90.1-2013',
            climateZone: 'ASHRAE 169-2013-5A',
            floorArea: 1000,
            numStories: 3,
            aspectRatio: 1.5,
            floorToFloorHeight: 3.0,
          },
          applyDefaultMeasures: true,
        },
      };

      const result = validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject a BCL template create request without required parameters', () => {
      const request = {
        id: '123',
        type: 'openstudio.bcl.template.create',
        params: {
          outputPath: '/path/to/model.osm',
        },
      };

      const result = validateRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject invalid floor area values', () => {
      const request = {
        id: '123',
        type: 'openstudio.bcl.template.create',
        params: {
          templateId: 'template-123',
          outputPath: '/path/to/model.osm',
          templateOptions: {
            floorArea: -100,
          },
        },
      };

      const result = validateRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject unsafe paths', () => {
      const request = {
        id: '123',
        type: 'openstudio.bcl.template.create',
        params: {
          templateId: 'template-123',
          outputPath: '/path/to/model.osm; rm -rf /',
        },
      };

      const result = validateRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('getValidationSchema', () => {
    it('should return schema for BCL template search', () => {
      const schema = getValidationSchema('openstudio.bcl.template.search');
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
    });

    it('should return schema for BCL template create', () => {
      const schema = getValidationSchema('openstudio.bcl.template.create');
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
    });

    it('should return undefined for unknown request types', () => {
      const schema = getValidationSchema('unknown.request.type');
      expect(schema).toBeUndefined();
    });
  });
});
