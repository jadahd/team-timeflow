import { Announcement } from '@/types/workforce';
import { useState, useEffect } from 'react';
import { Megaphone } from 'lucide-react';

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

  return (
    <div className={`px-6 py-2 flex items-center gap-3 text-sm ${
      ann.priority === 'urgent' ? 'bg-kiosk-danger/20' : 'bg-accent/10'
    }`}>
      <Megaphone className={`w-4 h-4 flex-shrink-0 ${ann.priority === 'urgent' ? 'text-kiosk-danger' : 'text-accent'}`} />
      <span className="text-kiosk-foreground flex-1 truncate">{ann.text}</span>
      {announcements.length > 1 && (
        <span className="text-kiosk-muted-foreground text-xs flex-shrink-0">
          {current + 1}/{announcements.length}
        </span>
      )}
    </div>
  );
};
