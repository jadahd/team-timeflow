import { Announcement } from '@/types/workforce';
import { useState, useEffect } from 'react';
import { Megaphone, PartyPopper } from 'lucide-react';

interface Props {
  announcements: Announcement[];
}

export const KioskAnnouncementsBanner = ({ announcements }: Props) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % announcements.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [announcements.length]);

  if (announcements.length === 0) return null;

  const ann = announcements[current];
  // Anniversary announcements get a celebratory style. They're tagged
  // by id prefix from useAnniversaries.
  const isAnniversary = ann.id.startsWith('anniversary-');
  const containerClass = isAnniversary
    ? 'bg-status-on-lunch/15 border-y border-status-on-lunch/30'
    : ann.priority === 'urgent'
    ? 'bg-kiosk-danger/20'
    : 'bg-accent/10';
  const iconClass = isAnniversary
    ? 'text-status-on-lunch'
    : ann.priority === 'urgent'
    ? 'text-kiosk-danger'
    : 'text-accent';

  return (
    <div className={`px-6 py-2 flex items-center gap-3 text-sm ${containerClass}`}>
      {isAnniversary ? (
        <PartyPopper className={`w-4 h-4 flex-shrink-0 ${iconClass}`} />
      ) : (
        <Megaphone className={`w-4 h-4 flex-shrink-0 ${iconClass}`} />
      )}
      <span
        className={`flex-1 truncate ${
          isAnniversary ? 'text-kiosk-foreground font-medium' : 'text-kiosk-foreground'
        }`}
      >
        {ann.text}
      </span>
      {announcements.length > 1 && (
        <span className="text-kiosk-muted-foreground text-xs flex-shrink-0">
          {current + 1}/{announcements.length}
        </span>
      )}
    </div>
  );
};
