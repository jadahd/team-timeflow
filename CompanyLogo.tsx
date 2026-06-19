import { useCompany } from '@/hooks/useCompany';

interface CompanyLogoProps {
  /** Tile size in tailwind units, e.g. 10 → w-10 h-10. Defaults to 10. */
  size?: 'sm' | 'md' | 'lg';
  /** Background color class. Defaults to bg-accent for kiosk/landing. */
  bgClass?: string;
  /** Letter color class. Defaults to text-accent-foreground. */
  textClass?: string;
}

const sizeMap = {
  sm: { box: 'w-9 h-9', text: 'text-base', radius: 'rounded-lg' },
  md: { box: 'w-10 h-10', text: 'text-lg', radius: 'rounded-lg' },
  lg: { box: 'w-16 h-16', text: 'text-2xl', radius: 'rounded-2xl' },
};

/**
 * Renders the company's logo image when one is uploaded, otherwise falls
 * back to a colored tile with the company's logo letter. Used by the
 * landing page, kiosk header, and admin sidebar.
 */
export const CompanyLogo = ({
  size = 'md',
  bgClass = 'bg-accent',
  textClass = 'text-accent-foreground',
}: CompanyLogoProps) => {
  const { company } = useCompany();
  const dim = sizeMap[size];

  if (company.logoUrl) {
    return (
      <img
        src={company.logoUrl}
        alt={`${company.name} logo`}
        className={`${dim.box} ${dim.radius} object-cover bg-white`}
      />
    );
  }

  return (
    <div className={`${dim.box} ${dim.radius} ${bgClass} flex items-center justify-center`}>
      <span className={`${textClass} ${dim.text} font-bold`}>{company.logoLetter}</span>
    </div>
  );
};
