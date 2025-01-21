import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';

interface BufferSelectorProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const BufferSelector: React.FC<BufferSelectorProps> = ({
  value,
  onChange,
  className
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue) && newValue >= 0 && newValue <= 100) {
      onChange(Number(newValue.toFixed(1)));
    }
  };

  const adjustValue = (delta: number) => {
    const newValue = value + delta;
    if (newValue >= 0 && newValue <= 100) {
      onChange(Number(newValue.toFixed(1)));
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm text-slate-300">
        Buffer Amount (to account for pool changes)
      </Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={value}
            onChange={handleInputChange}
            className="pr-12 bg-slate-800/50"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
            %
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 p-0"
            onClick={() => adjustValue(0.1)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 p-0"
            onClick={() => adjustValue(-0.1)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        {value === 0 
          ? "No buffer - amount needed may increase as others stake" 
          : `Adding ${value}% extra to account for pool changes`}
      </p>
    </div>
  );
};