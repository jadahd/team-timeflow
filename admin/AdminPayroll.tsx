import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_OT_CONFIG } from '@/data/mockData';
import { useEmployees } from '@/hooks/useEmployees';
import { useCompany } from '@/hooks/useCompany';
import { fetchTimeEntriesInRange } from '@/lib/db';
import { PayrollSummary, TimeEntry, Employee } from '@/types/workforce';
import { formatTimestamp12, summarizeLunch } from '@/lib/time';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText, ChevronLeft, ChevronRight, Printer } from 'lucide-react';

function calculatePayroll(
  employees: ReturnType<typeof useEmployees>,
  timeEntries: TimeEntry[],
): PayrollSummary[] {
  // Include anyone who has hourly pay AND either is currently active OR
  // has time entries in this period. This guarantees offboarded employees
  // still get their final paycheck calculated when running payroll for a
  // past pay period.
  const employeeIdsWithHours = new Set(timeEntries.map((te) => te.employeeId));
  return employees
    .filter(
      (e) =>
        e.payType === 'hourly' &&
        (e.isActive || employeeIdsWithHours.has(e.id)),
    )
    .map(emp => {
      const entries = timeEntries.filter(t => t.employeeId === emp.id);

      // Split entries by type. Only `work` hours count toward the 40h OT
      // threshold — PTO/sick/holiday/etc. are paid leave that should NOT
      // push someone into overtime just because they took a vacation week.
      let workedHours = 0;
      let paidLeaveHours = 0;
      for (const entry of entries) {
        const start = new Date(entry.clockIn).getTime();
        const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
        const breakMs = entry.breaks.reduce((s, b) => {
          const bEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now();
          return s + (bEnd - new Date(b.startTime).getTime());
        }, 0);
        const hours = Math.max(0, (end - start - breakMs) / 3600000);
        if (entry.entryType === 'work') {
          workedHours += hours;
        } else {
          paidLeaveHours += hours;
        }
      }

      const regularHours = Math.min(workedHours, DEFAULT_OT_CONFIG.otThresholdHours);
      const overtimeHours = Math.max(0, workedHours - DEFAULT_OT_CONFIG.otThresholdHours);
      const rate = emp.hourlyRate ?? 0;
      const regularPay = regularHours * rate;
      const overtimePay = overtimeHours * rate * DEFAULT_OT_CONFIG.otMultiplier;
      const paidLeavePay = paidLeaveHours * rate;
      const grossPay = regularPay + overtimePay + paidLeavePay;
      const totalHours = workedHours + paidLeaveHours;

      const round2 = (n: number) => Math.round(n * 100) / 100;
      return {
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department,
        workedHours: round2(workedHours),
        regularHours: round2(regularHours),
        overtimeHours: round2(overtimeHours),
        paidLeaveHours: round2(paidLeaveHours),
        totalHours: round2(totalHours),
        hourlyRate: rate,
        regularPay: round2(regularPay),
        overtimePay: round2(overtimePay),
        paidLeavePay: round2(paidLeavePay),
        grossPay: round2(grossPay),
        notes: [],
      };
    });
}

function exportCSV(
  data: PayrollSummary[],
  entries: TimeEntry[],
  employees: Employee[],
  companyName: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const startStr = formatDate(periodStart);
  const endStr = formatDate(periodEnd);
  // Top metadata rows (Excel/Sheets show them clearly)
  const metaRows: (string | number)[][] = [
    [companyName],
    [`Payroll Export`],
    [`Pay Period: ${startStr} – ${endStr}`],
    [`Generated: ${formatDate(new Date())}`],
    [],
    ['SUMMARY'],
  ];
  const summaryHeaders = ['Employee', 'Department', 'Pay Period Start', 'Pay Period End', 'Regular Hours', 'OT Hours', 'PTO Hours', 'Total Hours', 'Rate', 'Regular Pay', 'OT Pay', 'PTO Pay', 'Gross Pay'];
  const summaryDataRows: (string | number)[][] = data.map((d) => [
    d.employeeName,
    d.department,
    isoDate(periodStart),
    isoDate(periodEnd),
    d.regularHours,
    d.overtimeHours,
    d.paidLeaveHours,
    d.totalHours,
    d.hourlyRate,
    d.regularPay,
    d.overtimePay,
    d.paidLeavePay,
    d.grossPay,
  ]);

  // Detail section — every individual clock-in/out
  const detailRows = buildDetailRows(entries, employees);
  const detailHeaders = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours Worked', 'Break Minutes', 'Type', 'Notes'];
  const detailDataRows: (string | number)[][] = detailRows.map((r) => [
    r.employeeName,
    r.date,
    r.clockIn,
    r.clockOut,
    r.hoursWorked,
    r.breakMinutes,
    r.entryType,
    r.notes,
  ]);

  const allRows: (string | number)[][] = [
    ...metaRows,
    summaryHeaders,
    ...summaryDataRows,
    [],
    ['TIME ENTRY DETAIL'],
    detailHeaders,
    ...detailDataRows,
  ];

  const csv = allRows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-${isoDate(periodStart)}-to-${isoDate(periodEnd)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isoDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns the Friday on or before `today` (start of the Fri–Thu pay week). */
function getPayPeriodStart(today: Date): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun ... 5=Fri ... 6=Sat
  const daysBack = (dow - 5 + 7) % 7;
  d.setDate(d.getDate() - daysBack);
  return d;
}

/** Per-entry breakdown rows used by both CSV and PDF detail sections.
 *  Returns rows sorted by employee name → date → clock-in time. */
interface DetailRow {
  employeeName: string;
  date: string;       // formatted, e.g. "Fri, May 15"
  isoDate: string;    // YYYY-MM-DD for sorting / filters
  clockIn: string;    // 12-hour, e.g. "8:00 AM"
  clockOut: string;   // 12-hour or "(still in)"
  hoursWorked: string;
  breakMinutes: string;
  entryType: string;
  notes: string;
}

function buildDetailRows(entries: TimeEntry[], employees: Employee[]): DetailRow[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const rows: DetailRow[] = entries
    .map((entry) => {
      const emp = byId.get(entry.employeeId);
      const start = new Date(entry.clockIn);
      const startMs = start.getTime();
      const endMs = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
      const breakMs = entry.breaks.reduce((s, b) => {
        const bEnd = b.endTime ? new Date(b.endTime).getTime() : startMs;
        return s + (bEnd - new Date(b.startTime).getTime());
      }, 0);
      const hours = (endMs - startMs - breakMs) / 3600000;
      const dayLabel = start.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return {
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        date: dayLabel,
        isoDate: entry.date,
        clockIn: formatTimestamp12(entry.clockIn),
        clockOut: entry.clockOut ? formatTimestamp12(entry.clockOut) : '(still in)',
        hoursWorked: hours.toFixed(2),
        breakMinutes: Math.round(breakMs / 60000).toString(),
        entryType: entry.entryType,
        notes: entry.notes.join('; '),
      };
    })
    .sort((a, b) => {
      if (a.employeeName !== b.employeeName) return a.employeeName.localeCompare(b.employeeName);
      return a.isoDate.localeCompare(b.isoDate);
    });
  return rows;
}

function exportPDF(
  data: PayrollSummary[],
  entries: TimeEntry[],
  employees: Employee[],
  companyName: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const today = new Date();
  const generatedStr = today.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`${companyName} — Payroll Export`, 40, 50);

  // Subtitle: date range + OT rules + generated date
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Pay Period: ${formatDate(periodStart)} – ${formatDate(periodEnd)}`, 40, 70);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Friday–Thursday · 40hr OT threshold · 1.5x rate`, 40, 84);
  doc.text(`Generated ${generatedStr}`, 40, 98);

  // Total gross box
  const totalGross = data.reduce((sum, p) => sum + p.grossPay, 0);
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Estimated Total Gross:', 40, 126);
  doc.text(`$${totalGross.toFixed(2)}`, 220, 126);

  // Body table
  autoTable(doc, {
    startY: 146,
    head: [['Employee', 'Dept', 'Reg Hrs', 'OT Hrs', 'PTO Hrs', 'Rate', 'Reg Pay', 'OT Pay', 'PTO Pay', 'Gross']],
    body: data.map((p) => {
      const rateSet = p.hourlyRate > 1;
      return [
        p.employeeName + (rateSet ? '' : ' (rate not set)'),
        p.department,
        p.regularHours.toString(),
        p.overtimeHours.toString(),
        p.paidLeaveHours > 0 ? p.paidLeaveHours.toString() : '—',
        rateSet ? `$${p.hourlyRate.toFixed(2)}` : '—',
        rateSet ? `$${p.regularPay.toFixed(2)}` : '—',
        rateSet ? `$${p.overtimePay.toFixed(2)}` : '—',
        rateSet && p.paidLeaveHours > 0 ? `$${p.paidLeavePay.toFixed(2)}` : '—',
        rateSet ? `$${p.grossPay.toFixed(2)}` : '—',
      ];
    }),
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: 255,
      fontSize: 9,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: 30,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
    },
    margin: { left: 40, right: 40 },
  });

  // Footer disclaimer on summary page
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Estimated values only. Verify before paying. Rows marked "rate not set" are pending and shown for awareness.',
    40,
    pageHeight - 30,
  );

  // ===== Detail page(s): every individual clock-in/out =====
  const detail = buildDetailRows(entries, employees);
  if (detail.length > 0) {
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(`${companyName} — Time Entry Detail`, 40, 50);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Pay Period: ${formatDate(periodStart)} – ${formatDate(periodEnd)}`, 40, 68);
    doc.text(`${detail.length} time entry${detail.length === 1 ? '' : ''} recorded`, 40, 82);

    autoTable(doc, {
      startY: 100,
      head: [['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Breaks (min)', 'Type', 'Notes']],
      body: detail.map((r) => [
        r.employeeName,
        r.date,
        r.clockIn,
        r.clockOut,
        r.hoursWorked,
        r.breakMinutes,
        r.entryType,
        r.notes,
      ]),
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: 255,
        fontSize: 9,
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: 30,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      margin: { left: 40, right: 40 },
    });
  }

  const filename = `payroll-${isoDate(periodStart)}-to-${isoDate(periodEnd)}.pdf`;
  doc.save(filename);
}

// ============================================================
// Per-employee Time Cards PDF
//
// Mirrors the format of the legacy Sacs Western Store "Employee Time
// Report" — one employee per page, single-row-per-shift with break time
// subtracted from the Hours column.
// ============================================================
function formatHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** Grand-total format with 4-digit hour pad (e.g. "0054:52:25"). */
function formatHMSGrand(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  return `${h.toString().padStart(4, '0')}:${pad2(m)}:${pad2(s)}`;
}

function formatTimeCardDate(iso: string): string {
  // 5/01/2026 style — matches the sample.
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getMonth() + 1}/${pad(d.getDate())}/${d.getFullYear()}`;
}

function exportTimeCardsPDF(
  entries: TimeEntry[],
  employees: Employee[],
  companyName: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  // Group entries by employee, then sort by clock_in within each group.
  const byEmployee = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const list = byEmployee.get(entry.employeeId) ?? [];
    list.push(entry);
    byEmployee.set(entry.employeeId, list);
  }
  byEmployee.forEach((list) =>
    list.sort(
      (a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime(),
    ),
  );

  // Only include active employees with at least one entry, sorted by name.
  const employeesToPrint = employees
    .filter((e) => byEmployee.has(e.id))
    .sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    );

  if (employeesToPrint.length === 0) {
    doc.setFontSize(12);
    doc.text(
      `No time entries between ${formatDate(periodStart)} and ${formatDate(periodEnd)}.`,
      40,
      80,
    );
    doc.save(
      `time-cards-${isoDate(periodStart)}-to-${isoDate(periodEnd)}.pdf`,
    );
    return;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const periodStartLabel = formatTimeCardDate(periodStart.toISOString());
  const periodEndLabel = formatTimeCardDate(periodEnd.toISOString());
  const runStamp = `${formatTimeCardDate(new Date().toISOString())} ${new Date().toLocaleTimeString(
    [],
    { hour: 'numeric', minute: '2-digit' },
  )}`;

  employeesToPrint.forEach((emp, idx) => {
    if (idx > 0) doc.addPage();

    // Centered title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Employee Time Report', pageWidth / 2, 50, { align: 'center' });

    // Italic "Confidential" subtitle
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(60, 70, 90);
    doc.text('Confidential', pageWidth / 2, 66, { align: 'center' });

    // Top-left: company name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(companyName, 40, 50);

    // Top-right: From / To
    doc.text(`From: ${periodStartLabel}`, pageWidth - 40, 50, { align: 'right' });
    doc.text(`To:   ${periodEndLabel}`, pageWidth - 40, 64, { align: 'right' });

    // Employee header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee', 40, 110);
    doc.setFont('helvetica', 'normal');
    doc.text('Date', 200, 110);
    doc.text('Time In', 260, 110);
    doc.text('Time Out', 320, 110);
    doc.text('Lunch', 380, 110);
    doc.text('Hours', 490, 110);
    // Underline header row
    doc.setDrawColor(160, 160, 160);
    doc.line(40, 116, pageWidth - 40, 116);

    // Employee name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`${emp.firstName} ${emp.lastName}`, 40, 134);
    doc.setDrawColor(160, 160, 160);
    doc.line(40, 138, 180, 138);

    // Build rows for this employee — one per shift, hours = worked time
    // (clock-out minus clock-in minus total break time).
    const empEntries = byEmployee.get(emp.id) ?? [];
    let runningMs = 0;
    const rows = empEntries.map((entry) => {
      const inMs = new Date(entry.clockIn).getTime();
      const outMs = entry.clockOut ? new Date(entry.clockOut).getTime() : null;
      const breakMs = entry.breaks.reduce((s, b) => {
        const bEnd = b.endTime
          ? new Date(b.endTime).getTime()
          : b.expectedReturn
          ? new Date(b.expectedReturn).getTime()
          : inMs;
        return s + Math.max(0, bEnd - new Date(b.startTime).getTime());
      }, 0);
      const workedMs = outMs !== null ? Math.max(0, outMs - inMs - breakMs) : 0;
      if (outMs !== null) runningMs += workedMs;
      const lunch = summarizeLunch(entry.breaks);

      return {
        date: formatTimeCardDate(entry.clockIn),
        timeIn: new Date(entry.clockIn).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        }),
        timeOut: outMs !== null
          ? new Date(outMs).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })
          : '',
        // Range only — duration removed at the user's request since the
        // start/end times already convey the lunch length.
        lunch: lunch ? lunch.range : '—',
        hours: outMs !== null ? formatHMS(workedMs) : '—',
        notClockedOut: outMs === null,
      };
    });

    autoTable(doc, {
      startY: 150,
      head: [],
      body: rows.map((r) => [
        r.date,
        r.timeIn,
        r.timeOut,
        r.lunch,
        r.notClockedOut ? `${r.hours}   Not Clocked Out` : r.hours,
      ]),
      bodyStyles: {
        fontSize: 10,
        textColor: 30,
        cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
      },
      columnStyles: {
        0: { cellWidth: 60, halign: 'left' }, // Date
        1: { cellWidth: 60, halign: 'left' }, // Time In
        2: { cellWidth: 60, halign: 'left' }, // Time Out
        3: { cellWidth: 110, halign: 'left' }, // Lunch (range + duration)
        4: { halign: 'left' }, // Hours
      },
      margin: { left: 200, right: 40 },
      theme: 'plain',
    });

    // Total row, right-aligned beneath the Hours column (which starts at x=490).
    // @ts-expect-error — jspdf-autotable mutates doc.lastAutoTable
    const lastY = (doc.lastAutoTable?.finalY as number) ?? 160;
    doc.setDrawColor(160, 160, 160);
    doc.line(490, lastY + 4, pageWidth - 40, lastY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(formatHMSGrand(runningMs), pageWidth - 40, lastY + 18, {
      align: 'right',
    });

    // Footer: page number left, run stamp right
    const pageStr = `Page:   ${idx + 1}`;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(pageStr, 40, pageHeight - 30);
    doc.text(`Run:   ${runStamp}`, pageWidth - 40, pageHeight - 30, {
      align: 'right',
    });
  });

  doc.save(`time-cards-${isoDate(periodStart)}-to-${isoDate(periodEnd)}.pdf`);
}

export const AdminPayroll = () => {
  const employees = useEmployees();
  const { company } = useCompany();

  // Pay-period state: defaults to the Friday on or before today.
  const [periodStart, setPeriodStart] = useState<Date>(() => getPayPeriodStart(new Date()));
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 6);

  // Fetch time entries for the selected pay period.
  const [periodEntries, setPeriodEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTimeEntriesInRange(isoDate(periodStart), isoDate(periodEnd)).then((entries) => {
      if (!cancelled) {
        setPeriodEntries(entries);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart.getTime()]);

  const payroll = calculatePayroll(employees, periodEntries);
  const totalGross = payroll.reduce((sum, p) => sum + p.grossPay, 0);
  // Track how many employees the totalGross is incomplete because of —
  // anyone with hours worked but no pay rate set contributes $0 to gross,
  // making the headline number misleading without a caveat.
  const employeesWithRates = payroll.filter((p) => p.hourlyRate > 1).length;
  const employeesMissingRate = payroll.filter(
    (p) => p.hourlyRate <= 1 && (p.workedHours > 0 || p.paidLeaveHours > 0),
  ).length;
  const grossIsIncomplete = employeesMissingRate > 0;

  const goPrevWeek = () => {
    const d = new Date(periodStart);
    d.setDate(d.getDate() - 7);
    setPeriodStart(d);
  };
  const goNextWeek = () => {
    const d = new Date(periodStart);
    d.setDate(d.getDate() + 7);
    setPeriodStart(d);
  };
  const goCurrentWeek = () => setPeriodStart(getPayPeriodStart(new Date()));

  // Is the displayed period the current one (containing today)?
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentStart = getPayPeriodStart(today);
  const isCurrent = periodStart.getTime() === currentStart.getTime();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll Export</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Friday–Thursday · 40hr OT threshold · 1.5x rate
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportTimeCardsPDF(
                periodEntries,
                employees,
                company.name,
                periodStart,
                periodEnd,
              )
            }
            title="One printable time card per employee, for this pay period"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Time Cards
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(payroll, periodEntries, employees, company.name, periodStart, periodEnd)}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPDF(payroll, periodEntries, employees, company.name, periodStart, periodEnd)}
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Pay period navigator */}
      <Card className="mb-4">
        <CardContent className="p-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={goPrevWeek} aria-label="Previous week">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {formatDate(periodStart)} – {formatDate(periodEnd)}
            </p>
            <p className="text-xs text-muted-foreground">
              {isCurrent ? 'Current pay period' : (
                <button onClick={goCurrentWeek} className="underline hover:text-foreground">
                  Jump to current week
                </button>
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={goNextWeek} aria-label="Next week">
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Estimated Total Gross</p>
            {grossIsIncomplete && (
              <p className="text-xs text-warning mt-0.5">
                {employeesWithRates === 0
                  ? `Pay rates not set — gross cannot be calculated until rates are entered in Admin → Employees`
                  : `${employeesMissingRate} of ${employeesWithRates + employeesMissingRate} employees missing a rate — actual gross is higher than shown`}
              </p>
            )}
          </div>
          {employeesWithRates === 0 ? (
            <span className="text-2xl font-bold text-muted-foreground tabular-nums">—</span>
          ) : (
            <span className="text-2xl font-bold text-foreground tabular-nums">
              ${totalGross.toFixed(2)}
              {grossIsIncomplete && (
                <span className="text-sm text-warning ml-1">*</span>
              )}
            </span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead className="text-right">Reg Hrs</TableHead>
                <TableHead className="text-right">OT Hrs</TableHead>
                <TableHead className="text-right">PTO Hrs</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Reg Pay</TableHead>
                <TableHead className="text-right">OT Pay</TableHead>
                <TableHead className="text-right">PTO Pay</TableHead>
                <TableHead className="text-right">Gross</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payroll.map(p => {
                const rateSet = p.hourlyRate > 1;
                return (
                  <TableRow key={p.employeeId} className={rateSet ? '' : 'opacity-60'}>
                    <TableCell className="text-sm font-medium text-foreground">
                      {p.employeeName}
                      {!rateSet && (
                        <span className="ml-2 text-xs italic text-warning">rate not set</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.department}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{p.regularHours}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {p.overtimeHours > 0 ? <span className="text-warning font-medium">{p.overtimeHours}</span> : '0'}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {p.paidLeaveHours > 0
                        ? <span className="text-info">{p.paidLeaveHours}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {rateSet ? `$${p.hourlyRate.toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {rateSet ? `$${p.regularPay.toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {rateSet ? `$${p.overtimePay.toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {rateSet ? `$${p.paidLeavePay.toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">
                      {rateSet ? `$${p.grossPay.toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
