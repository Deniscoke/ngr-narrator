// ============================================================
// Repository Interface — swappable between localStorage / Supabase
// ============================================================

export interface Repository<T> {
  getAll(filter?: Partial<T>): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(item: Omit<T, "id" | "createdAt">): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
