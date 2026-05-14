import { Employee } from '@/types/workforce';
import { MOCK_EMPLOYEES as initialEmployees } from './mockData';

let employees: Employee[] = [...initialEmployees];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getEmployeesSnapshot(): Employee[] {
  return employees;
}

export function addEmployee(emp: Employee): void {
  employees = [...employees, emp];
  notify();
}
