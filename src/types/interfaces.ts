import { BranchLocation, PaginatedResult, UpdateBranchDto } from './location';

export interface IBranchRepository {
  create(branch: BranchLocation): Promise<BranchLocation>;
  getById(id: string): Promise<BranchLocation>;
  update(
    id: string,
    updates: UpdateBranchDto & { latitude?: number; longitude?: number }
  ): Promise<BranchLocation>;
  list(limit?: number, nextToken?: string): Promise<PaginatedResult<BranchLocation>>;
}

export interface IGeocoderService {
  geocode(city: string, country: string, state?: string): Promise<{ latitude: number; longitude: number }>;
}