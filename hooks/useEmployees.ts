import { useSyncExternalStore } from 'react';
import { Employee } from '@/types/workforce';
import { subscribe, getEmployeesSnapshot } from '@/data/employeeStore';

export function useEmployees(): Employee[] {
  return useSyncExternalStore(subscribe, getEmployeesSnapshot);
}
