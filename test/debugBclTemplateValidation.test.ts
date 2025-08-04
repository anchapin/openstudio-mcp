/**
 * BCL Template Validation tests
 */
import { describe, it, expect } from 'vitest';
import { validateRequest } from '../src/utils/validation';

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
  });
});
