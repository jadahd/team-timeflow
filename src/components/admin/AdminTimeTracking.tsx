import { MOCK_TIME_ENTRIES } from '@/data/mockData';
import { useEmployees } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const AdminTimeTracking = () => {
  const entriesWithNames = MOCK_TIME_ENTRIES.map(entry => {
    const emp = MOCK_EMPLOYEES.find(e => e.id === entry.employeeId);
    const start = new Date(entry.clockIn);
    const end = entry.clockOut ? new Date(entry.clockOut) : null;
    const totalMs = (end?.getTime() ?? Date.now()) - start.getTime();
    const breakMs = entry.breaks.reduce((sum, b) => {
      const bEnd = b.endTime ? new Date(b.endTime).getTime() : (b.expectedReturn ? new Date(b.expectedReturn).getTime() : Date.now());
      return sum + (bEnd - new Date(b.startTime).getTime());
    }, 0);
    const workedHours = (totalMs - breakMs) / 3600000;

    return {
      ...entry,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      initials: emp?.initials ?? '??',
      clockInTime: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      clockOutTime: end?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '—',
      workedHours: workedHours.toFixed(1),
      breakCount: entry.breaks.length,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Time Tracking — Today</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Breaks</TableHead>
                <TableHead className="text-right">Hours Worked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entriesWithNames.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center">{entry.initials}</span>
                      <span className="text-sm font-medium text-foreground">{entry.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.department}</TableCell>
                  <TableCell className="text-sm tabular-nums text-foreground">{entry.clockInTime}</TableCell>
                  <TableCell className="text-sm tabular-nums text-foreground">{entry.clockOutTime}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.breakCount}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">{entry.workedHours}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
