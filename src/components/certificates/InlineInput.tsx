import React from 'react';
import { cn } from '../../lib/utils';

export const InlineInput = ({ 
  value, 
  onChange, 
  minChars = 10,
  className,
  isExporting = false
}: { 
  value: string; 
  onChange: (val: string) => void; 
  minChars?: number;
  className?: string;
  isExporting?: boolean;
}) => {
  const safeValue = value || '';
  const width = Math.max(safeValue.length, minChars) + 'ch';
  
  if (isExporting) {
    return (
      <span
        className={cn(
          "inline-block border-b border-black text-center font-inherit text-inherit",
          className
        )}
        style={{ width, padding: '0', margin: '0 2px' }}
      >
        {safeValue}
      </span>
    );
  }

  return (
    <input 
      type="text"
      value={safeValue}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "inline-block bg-transparent border-b border-black outline-none text-center font-inherit text-inherit hover:bg-gray-100 focus:bg-gray-100 transition-colors print:hover:bg-transparent print:focus:bg-transparent",
        className
      )}
      style={{ width, padding: '0', margin: '0 2px' }}
    />
  );
};
