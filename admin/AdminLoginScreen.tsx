import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCompany } from '@/hooks/useCompany';
import { CompanyLogo } from '@/components/CompanyLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Password-only login screen shown when the admin is not authenticated.
 * Rendered as a wrapper around the admin routes.
 */
export const AdminLoginScreen = () => {
  const { login } = useAdminAuth();
  const { company } = useCompany();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const ok = login(password);
    setSubmitting(false);
    if (!ok) {
      toast.error('Incorrect password.');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <CompanyLogo size="lg" />
            <h1 className="text-xl font-bold text-foreground mt-4">{company.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">Admin Dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="admin-password" className="flex items-center gap-1.5 text-sm">
                <Lock className="w-3.5 h-3.5" />
                Admin password
              </Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={!password.trim() || submitting}>
              {submitting ? 'Checking…' : 'Unlock'}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-2">
              Forgot the password? Ask the owner or store manager.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
