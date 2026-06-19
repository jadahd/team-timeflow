import { useEffect } from 'react';
import { useCompany } from '@/hooks/useCompany';

/**
 * Reads the active Company config and applies its primary/accent colors
 * to the global CSS variables that Tailwind tokens are wired to.
 *
 * Tailwind tokens in src/index.css use `hsl(var(--primary))` etc, so we
 * convert the admin-friendly hex value to an HSL triple "H S% L%".
 */
export const CompanyThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { company } = useCompany();

  useEffect(() => {
    const root = document.documentElement;
    const primary = hexToHslTriple(company.primaryColor);
    const accent = hexToHslTriple(company.accentColor);
    if (primary) {
      root.style.setProperty('--primary', primary);
      root.style.setProperty('--sidebar-background', primary);
    }
    if (accent) {
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--sidebar-primary', accent);
      root.style.setProperty('--ring', accent);
      root.style.setProperty('--sidebar-ring', accent);
      root.style.setProperty('--kiosk-accent', accent);
    }
    // Keep the browser tab title in sync with the company name.
    if (company.name) {
      document.title = `${company.name} · Workforce`;
    }
  }, [company.primaryColor, company.accentColor, company.name]);

  return <>{children}</>;
};

/**
 * Converts "#1f2937" to "215 30% 16%" — the format CSS variables use
 * inside `hsl(var(--primary))`. Returns null for invalid input.
 */
function hexToHslTriple(hex: string): string | null {
  if (!hex) return null;
  const trimmed = hex.trim().replace(/^#/, '');
  const full =
    trimmed.length === 3
      ? trimmed.split('').map(c => c + c).join('')
      : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
