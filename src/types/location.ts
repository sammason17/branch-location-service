export interface BranchLocation {
  id: string;
  name: string;
  city: string;
  state?: string;
  latitude: number;
  longitude: number;
  country: string;
}

export interface CreateBranchDto {
  name: string;
  city: string;
  state?: string;
  country: string;
}

export interface UpdateBranchDto {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
}