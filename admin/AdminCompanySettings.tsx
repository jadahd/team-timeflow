import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';
import { Upload, RotateCcw, Trash2, Plus, X } from 'lucide-react';

const MAX_LOGO_BYTES = 500 * 1024; // 500 KB cap — the image is encoded as base64 and stored in company_settings, so keep it modest

export const AdminCompanySettings = () => {
  const { company, update, reset } = useCompany();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local draft so the admin can type freely and hit Save when ready.
  const [draft, setDraft] = useState(company);
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    update(draft);
    setDirty(false);
    toast({ title: 'Saved', description: 'Company settings updated.' });
  };

  const handleDiscard = () => {
    setDraft(company);
    setDirty(false);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all company settings to defaults? This cannot be undone.')) return;
    reset();
    setDraft({ ...company }); // will refresh via subscription
    setDirty(false);
    toast({ title: 'Reset', description: 'Company settings restored to defaults.' });
  };

  const handleLogoUpload = (file: File) => {
    if (file.size > MAX_LOGO_BYTES) {
      toast({
        title: 'Logo too large',
        description: `Please upload an image under ${Math.round(MAX_LOGO_BYTES / 1024)} KB.`,
        variant: 'destructive',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        set('logoUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    set('logoUrl', undefined);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Company Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Branding and configuration for this workspace. Changes sync to every device.
        </p>
      </div>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Branding</CardTitle>
          <CardDescription>How your company appears across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={draft.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Acme Supply Co."
              />
              <p className="text-xs text-muted-foreground mt-1">Shown on the landing page and kiosk header.</p>
            </div>
            <div>
              <Label htmlFor="company-short">Short name</Label>
              <Input
                id="company-short"
                value={draft.shortName}
                onChange={e => set('shortName', e.target.value)}
                placeholder="e.g. Acme"
              />
              <p className="text-xs text-muted-foreground mt-1">Used in tight spaces like the sidebar.</p>
            </div>
          </div>

          <div>
            <Label htmlFor="company-tagline">Tagline / subtitle</Label>
            <Input
              id="company-tagline"
              value={draft.tagline}
              onChange={e => set('tagline', e.target.value)}
              placeholder="e.g. Workforce Management System"
            />
          </div>

          <Separator />

          {/* Logo */}
          <div>
            <Label>Logo</Label>
            <div className="mt-2 flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-accent flex items-center justify-center overflow-hidden">
                {draft.logoUrl ? (
                  <img src={draft.logoUrl} alt="Logo preview" className="w-full h-full object-cover bg-white" />
                ) : (
                  <span className="text-accent-foreground text-3xl font-bold">{draft.logoLetter || '?'}</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-1.5" />
                    Upload logo
                  </Button>
                  {draft.logoUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveLogo}>
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = '';
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, SVG, or WebP. Under 500 KB. Square images look best.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <Label htmlFor="logo-letter" className="text-xs whitespace-nowrap">
                    Fallback letter
                  </Label>
                  <Input
                    id="logo-letter"
                    value={draft.logoLetter}
                    onChange={e => set('logoLetter', e.target.value.slice(0, 2).toUpperCase())}
                    maxLength={2}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">Used when no logo image is uploaded.</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Brand Colors</CardTitle>
          <CardDescription>Applied across buttons, the sidebar, and the kiosk accents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorField
              label="Primary color"
              hint="Sidebar background and primary buttons."
              value={draft.primaryColor}
              onChange={v => set('primaryColor', v)}
            />
            <ColorField
              label="Accent color"
              hint="Logo tile, highlights, and focus rings."
              value={draft.accentColor}
              onChange={v => set('accentColor', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Departments + Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Departments & Roles</CardTitle>
          <CardDescription>
            Drives the dropdowns when adding or editing employees. Add the
            ones you use, remove ones you don't.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ListEditor
            label="Departments"
            items={draft.departments}
            onChange={(items) => set('departments', items)}
            placeholder="e.g. Retail"
          />
          <Separator />
          <ListEditor
            label="Roles / Titles"
            items={draft.roles}
            onChange={(items) => set('roles', items)}
            placeholder="e.g. Sales Associate"
          />
        </CardContent>
      </Card>

      {/* Regional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Regional</CardTitle>
          <CardDescription>
            Timezone drives which day a clock-in falls under for payroll. Currency is used in money displays.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="tz">Timezone</Label>
            <Input
              id="tz"
              value={draft.timezone}
              onChange={e => set('timezone', e.target.value)}
              placeholder="e.g. America/Chicago"
            />
          </div>
          <div>
            <Label htmlFor="currency">Currency code</Label>
            <Input
              id="currency"
              value={draft.currency}
              onChange={e => set('currency', e.target.value.toUpperCase().slice(0, 3))}
              placeholder="USD"
              maxLength={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Schedule Integration</CardTitle>
          <CardDescription>
            Optional. Connect Google Sheet tabs to pull schedules into the Attendance page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="schedule-url">Google Sheet CSV URLs</Label>
            <Textarea
              id="schedule-url"
              value={draft.scheduleCsvUrl ?? ''}
              onChange={(e) => set('scheduleCsvUrl', e.target.value || undefined)}
              placeholder={
                'https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&output=csv\n' +
                'https://docs.google.com/spreadsheets/d/e/.../pub?gid=12345&output=csv'
              }
              rows={4}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              One URL per line. Paste a second URL on the next line for a "next week"
              tab — the app reads both and shows today's matching shifts.
            </p>
          </div>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>
              <strong>How to get a URL:</strong> Open your Google Sheet → File →
              Share → Publish to web → pick the specific tab from the dropdown
              (not "Entire document") → choose "Comma-separated values (.csv)" → Publish.
              Repeat for each tab you want to read.
            </p>
            <p>
              <strong>Supported formats:</strong> a weekly grid (one row per employee,
              day-of-week columns, "For the Week of: MM/DD/YY" header) OR a flat list
              (columns: Date, Employee, Start, End, Department, Notes).
            </p>
            <p>
              <strong>Heads up:</strong> "Publish to web" makes the tab readable by
              anyone with the URL. For internal schedule data this is usually fine.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pb-6">
        <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Reset to defaults
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleDiscard} disabled={!dirty}>
            Discard
          </Button>
          <Button type="button" onClick={handleSave} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Reusable list editor for departments + roles. Lets admin add and
 * remove items. Used in Company Settings.
 */
const ListEditor = ({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) => {
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (items.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      return; // duplicate, silently ignore
    }
    onChange([...items, trimmed]);
    setDraft('');
  };

  const handleRemove = (item: string) => {
    onChange(items.filter((i) => i !== item));
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mt-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder ?? 'Add new...'}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs italic text-muted-foreground mt-3">No {label.toLowerCase()} yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemove(item)}
                aria-label={`Remove ${item}`}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Existing employees keep their current {label.toLowerCase().replace(/s$/, '')} even if you
        remove an entry here — the value just won't show in the dropdown for new employees.
      </p>
    </div>
  );
};

/** Hex color picker that also accepts manual hex entry. */
const ColorField = ({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) => {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 mt-1.5">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-12 h-10 rounded-md border border-input bg-background cursor-pointer"
          aria-label={`${label} swatch`}
        />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
};
