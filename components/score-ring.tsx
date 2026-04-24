'use client';

import { motion } from 'framer-motion';

interface ScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreRing({ score, size = 'md' }: ScoreRingProps) {
  const sizes = {
    sm: { container: 'w-10 h-10', text: 'text-xs' },
    md: { container: 'w-14 h-14', text: 'text-sm' },
    lg: { container: 'w-20 h-20', text: 'text-lg' },
  };

  const getColor = (score: number) => {
    if (score >= 80) return '#10B981'; // success (emerald)
    if (score >= 60) return '#F59E0B'; // warning (amber)
    return '#4F6EF7'; // info (blue)
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = getColor(score);

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`relative flex items-center justify-center flex-shrink-0 ${sizes[size].container}`}
    >
      <svg className="absolute inset-0 -rotate-90 w-full h-full">
        {/* Background circle */}
        <circle
          cx="50%"
          cy="50%"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-border"
        />
        {/* Progress circle */}
        <motion.circle
          cx="50%"
          cy="50%"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          strokeLinecap="round"
          animate={{
            strokeDashoffset,
          }}
          transition={{
            duration: 0.8,
            ease: 'easeInOut',
          }}
        />
      </svg>

      {/* Score text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center justify-center"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4 }}
          className={`font-bold text-foreground ${sizes[size].text}`}
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground">Score</span>
      </motion.div>
    </motion.div>
  );
}
