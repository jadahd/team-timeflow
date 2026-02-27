import { useState } from 'react';
import { Employee } from '@/types/workforce';

interface Props {
  employee: Employee;
  onSuccess: () => void;
  onCancel: () => void;
}

export const KioskPinEntry = ({ employee, onSuccess, onCancel }: Props) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);

    if (newPin.length === 4) {
      if (newPin === employee.pin) {
        onSuccess();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => { setPin(''); setShake(false); }, 600);
      }
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError(false);
  };

  return (
    <div className="animate-slide-in flex flex-col items-center gap-6 w-full max-w-sm">
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
          <span className="text-accent-foreground text-3xl font-bold">{employee.initials}</span>
        </div>
        <h2 className="text-xl font-semibold text-kiosk-foreground">{employee.firstName} {employee.lastName}</h2>
        <p className="text-kiosk-muted-foreground text-sm">{employee.role} · {employee.department}</p>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-4 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full transition-all duration-150 ${
              i < pin.length
                ? error ? 'bg-kiosk-danger scale-110' : 'bg-accent scale-110'
                : 'bg-kiosk-muted'
            }`}
          />
        ))}
      </div>
      {error && <p className="text-kiosk-danger text-sm">Incorrect PIN – try again</p>}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map(key => (
          <button
            key={key}
            onClick={() => key === '⌫' ? handleDelete() : key && handleDigit(key)}
            disabled={!key}
            className={`h-16 rounded-xl text-2xl font-semibold transition-all duration-150 active:scale-95 ${
              key === '⌫'
                ? 'kiosk-card text-kiosk-muted-foreground hover:text-kiosk-foreground border border-kiosk-muted'
                : key
                ? 'kiosk-card text-kiosk-foreground hover:border-accent border border-kiosk-muted'
                : 'invisible'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <button onClick={onCancel} className="text-kiosk-muted-foreground hover:text-kiosk-foreground text-sm mt-2 transition-colors">
        ← Back
      </button>
    </div>
  );
};
