// Employee data store.
//
// Sources truth from Supabase when configured, falls back to bundled mock
// data otherwise so the app keeps working without a backend (useful for
// local-only demos and unit tests).
//
// Exposes a subscribe/snapshot API consumed by useEmployees, so individual
// components don't need to know whether the data came from Supabase or
// from the mock seed.

import { Employee } from '@/types/workforce';
import { MOCK_EMPLOYEES as initialEmployees } from './mockData';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  fetchEmployees,
  createEmployee as dbCreateEmployee,
  updateEmployee as dbUpdateEmployee,
  deleteEmployee as dbDeleteEmployee,
} from '@/lib/db';

let employees: Employee[] = [...initialEmployees];
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

/** Lazily fetch employees from Supabase on first subscribe. */
async function loadFromSupabase() {
  if (loaded) return;
  loaded = true;
  if (!isSupabaseConfigured) return;
  const rows = await fetchEmployees();
  if (rows.length > 0) {
    employees = rows;
    notify();
  }
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  // Trigger the first load when the first consumer subscribes.
  void loadFromSupabase();
  return () => {
    listeners.delete(callback);
  };
}

export function getEmployeesSnapshot(): Employee[] {
  return employees;
}

/**
 * Add a new employee. Writes to Supabase when configured, otherwise just
 * appends to the in-memory list.
 */
export async function addEmployee(
  input: Omit<Employee, 'id' | 'createdAt'>,
): Promise<Employee | null> {
  if (isSupabaseConfigured) {
    const created = await dbCreateEmployee(input);
    if (created) {
      employees = [...employees, created];
      notify();
      return created;
    }
    return null;
  }
  // Local-only fallback
  const created: Employee = {
    ...input,
    id: `local-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  employees = [...employees, created];
  notify();
  return created;
}

/**
 * Update an existing employee's fields. Writes to Supabase when
 * configured, otherwise mutates the in-memory list.
 */
export async function updateEmployee(
  id: string,
  patch: Partial<Omit<Employee, 'id' | 'createdAt'>>,
): Promise<Employee | null> {
  if (isSupabaseConfigured) {
    const updated = await dbUpdateEmployee(id, patch);
    if (updated) {
      employees = employees.map((e) => (e.id === id ? updated : e));
      notify();
      return updated;
    }
    return null;
  }
  // Local-only fallback
  const existing = employees.find((e) => e.id === id);
  if (!existing) return null;
  const updated: Employee = { ...existing, ...patch };
  employees = employees.map((e) => (e.id === id ? updated : e));
  notify();
  return updated;
}

/**
 * Permanently remove an employee. WARNING: cascades to delete their
 * time entries via the foreign key — historical payroll data is lost.
 * Most admins should deactivate (set isActive=false) instead.
 */
export async function deleteEmployee(id: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const ok = await dbDeleteEmployee(id);
    if (ok) {
      employees = employees.filter((e) => e.id !== id);
      notify();
    }
    return ok;
  }
  employees = employees.filter((e) => e.id !== id);
  notify();
  return true;
}

/** Forces a fresh fetch from the database. */
export async function refreshEmployees(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const rows = await fetchEmployees();
  employees = rows;
  notify();
}
