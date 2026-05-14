import { useState } from 'react';
import { MOCK_TIME_ENTRIES, DEFAULT_OT_CONFIG } from '@/data/mockData';
import { useEmployees } from '@/hooks/useEmployees';
import { PayrollSummary } from '@/types/workforce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText } from 'lucide-react';

function calculatePayroll(employees: ReturnType<typeof useEmployees>): PayrollSummary[] {
  return employees
    .filter(e => e.payType === 'hourly' && e.isActive)
    .map(emp => {
      const entries = MOCK_TIME_ENTRIES.filter(t => t.employeeId === emp.id);
      const totalHours = entries.reduce((sum, entry) => {
        const start = new Date(entry.clockIn).getTime();
        const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
        const breakMs = entry.breaks.reduce((s, b) => {
          const bEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now();
          return s + (bEnd - new Date(b.startTime).getTime());
        }, 0);
        return sum + (end - start - breakMs) / 3600000;
      }, 0);

      const regularHours = Math.min(totalHours, DEFAULT_OT_CONFIG.otThresholdHours);
      const overtimeHours = Math.max(0, totalHours - DEFAULT_OT_CONFIG.otThresholdHours);
      const rate = emp.hourlyRate ?? 0;

      return {
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department,
        regularHours: Math.round(regularHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        hourlyRate: rate,
        regularPay: Math.round(regularHours * rate * 100) / 100,
        overtimePay: Math.round(overtimeHours * rate * DEFAULT_OT_CONFIG.otMultiplier * 100) / 100,
        grossPay: Math.round((regularHours * rate + overtimeHours * rate * DEFAULT_OT_CONFIG.otMultiplier) * 100) / 100,
        notes: [],
      };
    });
}

function exportCSV(data: PayrollSummary[]) {
  const headers = ['Employee', 'Department', 'Regular Hours', 'OT Hours', 'Total Hours', 'Rate', 'Regular Pay', 'OT Pay', 'Gross Pay'];
  const rows = data.map(d => [
    d.employeeName, d.department, d.regularHours, d.overtimeHours, d.totalHours,
    d.hourlyRate, d.regularPay, d.overtimePay, d.grossPay,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const AdminPayroll = () => {
  const payroll = calculatePayroll();
  const totalGross = payroll.reduce((sum, p) => sum + p.grossPay, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll Export</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pay Period: Friday–Thursday · 40hr OT threshold · 1.5x rate
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(payroll)}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" disabled>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estimated Total Gross</span>
          <span className="text-2xl font-bold text-foreground tabular-nums">${totalGross.toFixed(2)}</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead className="text-right">Reg Hrs</TableHead>
                <TableHead className="text-right">OT Hrs</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Reg Pay</TableHead>
                <TableHead className="text-right">OT Pay</TableHead>
                <TableHead className="text-right">Gross</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payroll.map(p => (
                <TableRow key={p.employeeId}>
                  <TableCell className="text-sm font-medium text-foreground">{p.employeeName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.department}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{p.regularHours}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {p.overtimeHours > 0 ? <span className="text-warning font-medium">{p.overtimeHours}</span> : '0'}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">${p.hourlyRate.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">${p.regularPay.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">${p.overtimePay.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">${p.grossPay.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
