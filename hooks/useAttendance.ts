import { useCallback, useEffect, useState } from 'react';
import { AttendanceNote, AttendanceStatus } from '@/types/workforce';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  fetchAttendanceForDate,
  upsertAttendance as dbUpsert,
  deleteAttendance as dbDelete,
} from '@/lib/db';

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/** Loads attendance notes for the given date with mutation helpers. */
export function useAttendance(date: string = todayDateString()) {
  const [notes, setNotes] = useState<AttendanceNote[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setNotes([]);
      return;
    }
    setLoading(true);
    const rows = await fetchAttendanceForDate(date);
    setNotes(rows);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setStatus = async (
    employeeId: string,
    status: AttendanceStatus,
    note: string = '',
  ): Promise<boolean> => {
    const saved = await dbUpsert({ employeeId, date, status, note });
    if (!saved) return false;
    setNotes((prev) => {
      const without = prev.filter((n) => n.employeeId !== employeeId);
      return [...without, saved];
    });
    return true;
  };

  const clear = async (id: string): Promise<boolean> => {
    const ok = await dbDelete(id);
    if (ok) setNotes((prev) => prev.filter((n) => n.id !== id));
    return ok;
  };

  /** Quick lookup: get the existing note for an employee, or undefined. */
  const noteFor = (employeeId: string): AttendanceNote | undefined =>
    notes.find((n) => n.employeeId === employeeId);

  return { notes, loading, refresh, setStatus, clear, noteFor };
}
