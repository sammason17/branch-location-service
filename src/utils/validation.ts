import { CreateBranchDto, UpdateBranchDto } from '../types/location';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateCreateBranchDto(body: unknown): { valid: boolean; error?: string; data?: CreateBranchDto } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a valid JSON object' };
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload.name !== 'string' || payload.name.trim() === '') {
    return { valid: false, error: 'Name is required and must be a non-empty string' };
  }

  if (typeof payload.city !== 'string' || payload.city.trim() === '') {
    return { valid: false, error: 'City is required and must be a non-empty string' };
  }

  if (typeof payload.country !== 'string' || payload.country.trim() === '') {
    return { valid: false, error: 'Country is required and must be a non-empty string' };
  }

  if (payload.state !== undefined && (typeof payload.state !== 'string' || payload.state.trim() === '')) {
    return { valid: false, error: 'State must be a non-empty string if provided' };
  }

  return {
    valid: true,
    data: payload as unknown as CreateBranchDto,
  };
}

export function validateUpdateBranchDto(body: unknown): { valid: boolean; error?: string; data?: UpdateBranchDto } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a valid JSON object' };
  }

  const payload = body as Record<string, unknown>;

  if (Object.keys(payload).length === 0) {
    return { valid: false, error: 'Update payload cannot be empty' };
  }

  if (payload.name !== undefined && (typeof payload.name !== 'string' || payload.name.trim() === '')) {
    return { valid: false, error: 'Name must be a non-empty string' };
  }

  if (payload.city !== undefined && (typeof payload.city !== 'string' || payload.city.trim() === '')) {
    return { valid: false, error: 'City must be a non-empty string' };
  }

  if (payload.country !== undefined && (typeof payload.country !== 'string' || payload.country.trim() === '')) {
    return { valid: false, error: 'Country must be a non-empty string' };
  }

  if (payload.state !== undefined && (typeof payload.state !== 'string' || payload.state.trim() === '')) {
    return { valid: false, error: 'State must be a non-empty string' };
  }

  return {
    valid: true,
    data: payload as unknown as UpdateBranchDto,
  };
}