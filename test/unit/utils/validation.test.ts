import {
  validateCreateBranchDto,
  validateUpdateBranchDto,
} from '../../../src/utils/validation';

describe('Validation Utils', () => {
  describe('validateCreateBranchDto', () => {
    const validPayload = {
      name: 'Durham Central Branch',
      city: 'Durham',
      state: 'County Durham',
      country: 'UK',
    };

    it('returns valid with valid create payload', () => {
      const result = validateCreateBranchDto(validPayload);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(validPayload);
    });

    it('returns valid with valid create payload without state', () => {
      const payload = {
        name: 'Durham Central Branch',
        city: 'Durham',
        country: 'UK',
      };
      const result = validateCreateBranchDto(payload);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(payload);
    });

    it.each([
      [null, 'Request body must be a valid JSON object'],
      [undefined, 'Request body must be a valid JSON object'],
      ['raw-string', 'Request body must be a valid JSON object'],
      [[1, 2], 'Request body must be a valid JSON object'],
    ])('fails if body is not a plain object (%p)', (input, expectedError) => {
      const result = validateCreateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });

    it.each([
      [{ ...validPayload, name: '' }, 'Name is required and must be a non-empty string'],
      [{ ...validPayload, name: '   ' }, 'Name is required and must be a non-empty string'],
      [{ ...validPayload, name: 12345 }, 'Name is required and must be a non-empty string'],
      [{ ...validPayload, name: undefined }, 'Name is required and must be a non-empty string'],
    ])('fails when name is invalid', (input, expectedError) => {
      const result = validateCreateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });

    it.each([
      [{ ...validPayload, city: '' }, 'City is required and must be a non-empty string'],
      [{ ...validPayload, city: '  ' }, 'City is required and must be a non-empty string'],
      [{ ...validPayload, city: null }, 'City is required and must be a non-empty string'],
    ])('fails when city is invalid', (input, expectedError) => {
      const result = validateCreateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });

    it.each([
      [{ ...validPayload, country: '' }, 'Country is required and must be a non-empty string'],
      [{ ...validPayload, country: '  ' }, 'Country is required and must be a non-empty string'],
      [{ ...validPayload, country: null }, 'Country is required and must be a non-empty string'],
    ])('fails when country is invalid', (input, expectedError) => {
      const result = validateCreateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });

    it.each([
      [{ ...validPayload, state: '' }, 'State must be a non-empty string if provided'],
      [{ ...validPayload, state: '  ' }, 'State must be a non-empty string if provided'],
      [{ ...validPayload, state: 123 }, 'State must be a non-empty string if provided'],
    ])('fails when state is provided but invalid', (input, expectedError) => {
      const result = validateCreateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });
  });

  describe('validateUpdateBranchDto', () => {
    it('returns valid when only updating name', () => {
      const result = validateUpdateBranchDto({ name: 'New Name' });
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ name: 'New Name' });
    });

    it('returns valid when updating city', () => {
      const result = validateUpdateBranchDto({ city: 'London' });
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ city: 'London' });
    });

    it('returns valid when updating country', () => {
      const result = validateUpdateBranchDto({ country: 'France' });
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ country: 'France' });
    });

    it.each([
      [null, 'Request body must be a valid JSON object'],
      [undefined, 'Request body must be a valid JSON object'],
      ['string', 'Request body must be a valid JSON object'],
      [[], 'Request body must be a valid JSON object'],
    ])('fails if body is not a plain object (%p)', (input, expectedError) => {
      const result = validateUpdateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });

    it('fails if update payload is empty', () => {
      const result = validateUpdateBranchDto({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Update payload cannot be empty');
    });

    it.each([
      [{ name: '' }, 'Name must be a non-empty string'],
      [{ name: '   ' }, 'Name must be a non-empty string'],
      [{ name: 123 }, 'Name must be a non-empty string'],
    ])('fails when name is provided but invalid', (input, expectedError) => {
      const result = validateUpdateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });

    it.each([
      [{ city: '' }, 'City must be a non-empty string'],
      [{ city: '   ' }, 'City must be a non-empty string'],
      [{ city: 123 }, 'City must be a non-empty string'],
    ])('fails when city is provided but invalid', (input, expectedError) => {
      const result = validateUpdateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });

    it.each([
      [{ country: '' }, 'Country must be a non-empty string'],
      [{ country: '   ' }, 'Country must be a non-empty string'],
      [{ country: 123 }, 'Country must be a non-empty string'],
    ])('fails when country is provided but invalid', (input, expectedError) => {
      const result = validateUpdateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });

    it.each([
      [{ state: '' }, 'State must be a non-empty string'],
      [{ state: '   ' }, 'State must be a non-empty string'],
      [{ state: 123 }, 'State must be a non-empty string'],
    ])('fails when state is provided but invalid', (input, expectedError) => {
      const result = validateUpdateBranchDto(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
    });
  });
});
