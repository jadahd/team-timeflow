import { useEmployees } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddEmployeeDialog } from './AddEmployeeDialog';

export const AdminEmployees = () => {
  const employees = useEmployees();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{employees.length} total</span>
          <AddEmployeeDialog />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pay Type</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-accent">{emp.initials}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{emp.firstName} {emp.lastName}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.department}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.role}</TableCell>
                  <TableCell>
                    <Badge variant={emp.employmentStatus === 'full-time' ? 'default' : 'secondary'} className="text-xs">
                      {emp.employmentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{emp.payType}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                    {emp.payType === 'hourly' ? `$${emp.hourlyRate?.toFixed(2)}/hr` : `$${(emp.salary! / 1000).toFixed(0)}k/yr`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
