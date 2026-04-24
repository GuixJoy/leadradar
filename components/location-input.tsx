'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function LocationInput({ value, onChange }: LocationInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const suggestions = [
    'San Francisco, CA',
    'New York, NY',
    'Los Angeles, CA',
    'Chicago, IL',
    'Austin, TX',
    'Seattle, WA',
  ];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">City or Address</label>
      <motion.div
        animate={{
          borderColor: isFocused ? '#4F6EF7' : '#2D2D3A',
        }}
        className="relative flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2"
      >
        <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Enter location..."
          className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground text-sm"
        />
      </motion.div>

      {isFocused && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-card border border-border rounded-lg overflow-hidden"
        >
          {suggestions.map((suggestion) => (
            <motion.button
              key={suggestion}
              whileHover={{ backgroundColor: '#2D2D3A' }}
              onClick={() => {
                onChange(suggestion);
                setIsFocused(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              {suggestion}
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
