import { useState, useEffect } from 'react';

export const KioskClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-right">
      <div className="text-2xl font-bold text-kiosk-foreground tabular-nums">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-xs text-kiosk-muted-foreground">
        {time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
};
