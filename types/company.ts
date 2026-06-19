// Company / tenant configuration for the workforce app.
// One Company config is loaded at app boot from localStorage and applied
// throughout the UI (branding, departments, payroll rules).

export interface Company {
  /** Full display name, e.g. "SACS Supply & Outfitters" */
  name: string;
  /** Short name for tight spaces, e.g. "SACS Supply" */
  shortName: string;
  /** Single letter shown in the logo tile when no logo image is set, e.g. "S" */
  logoLetter: string;
  /** Optional logo image as a data URL (uploaded by admin) or external URL. When present, displayed instead of the letter tile. */
  logoUrl?: string;
  /** Subtitle shown on the landing and admin headers, e.g. "Workforce Management System" */
  tagline: string;
  /** Hex color for primary buttons + brand accents, e.g. "#1f2937" */
  primaryColor: string;
  /** Hex color for highlights and the logo tile, e.g. "#d97706" */
  accentColor: string;
  /** IANA timezone, e.g. "America/Chicago". Reserved for future use. */
  timezone: string;
  /** ISO currency code, e.g. "USD". Reserved for future use. */
  currency: string;
  /**
   * Optional URL to a Google Sheet published as CSV.
   * In Sheets: File → Share → Publish to web → Comma-separated values (.csv).
   * Expected columns (header row required, case-insensitive):
   *   Date,Employee,Start,End,Department,Notes
   * One row per shift. The Attendance page reads this to show
   * today's expected schedule alongside actual clock-ins.
   */
  scheduleCsvUrl?: string;
  /**
   * The department list that drives the dropdowns in the Add/Edit
   * Employee and Time Entry dialogs. Admin-managed from Company Settings.
   */
  departments: string[];
  /**
   * The job-title list shown as a dropdown in the Add/Edit Employee
   * dialog. Admin-managed from Company Settings. Prevents mistypes
   * (e.g. "Sales Associate" vs "Sales associate").
   */
  roles: string[];
}

export const DEFAULT_COMPANY: Company = {
  name: 'SACS Supply & Outfitters',
  shortName: 'SACS Supply',
  logoLetter: 'S',
  tagline: 'Workforce Management System',
  primaryColor: '#1f2937',
  accentColor: '#d97706',
  timezone: 'America/Chicago',
  currency: 'USD',
  departments: [
    'Retail',
    'Embroidery',
    'Uniform Department',
    'Management',
    'B2B Sales',
    'Industrial',
  ],
  roles: [
    'Owner',
    'Store Manager',
    'Sales Associate',
    'Embroidery Specialist',
    'Industrial',
    'Back / Warehouse',
    'Seasonal Staff',
  ],
};
