// src/components/animated/AnimatingTokenAmount.tsx
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePrevious } from "../../lib/hooks/animation";

function formatForDisplay(number = 0) {
  return parseFloat(Math.max(number, 0)).toFixed(8).split("").reverse();
}

function DecimalColumn() {
  return (
    <div>
      <span>.</span>
    </div>
  );
}

function NumberColumn({ digit, delta }: { digit: string; delta: string | null }) {
  const [position, setPosition] = useState(0);
  const [animationClass, setAnimationClass] = useState("");
  const previousDigit = usePrevious(digit);
  const columnContainer = useRef<HTMLDivElement>(null);

  const setColumnToNumber = (number: string) => {
    if (columnContainer.current) {
      setPosition(columnContainer.current.clientHeight * parseInt(number, 10));
    }
  };

  useEffect(() => {
    setAnimationClass(previousDigit !== digit ? delta || "" : "");
  }, [digit, delta, previousDigit]);

  useEffect(() => setColumnToNumber(digit), [digit]);

  return (
    <div className="ticker-column-container" ref={columnContainer}>
      <motion.div
        animate={{ y: position }}
        className={`ticker-column ${animationClass}`}
        onAnimationComplete={() => setAnimationClass("")}
      >
        {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((num) => (
          <div key={num} className="ticker-digit">
            <span>{num}</span>
          </div>
        ))}
      </motion.div>
      <span className="number-placeholder">0</span>
    </div>
  );
}

interface AnimatingTokenAmountProps {
  value: number;
}

export default function AnimatingTokenAmount({ value }: AnimatingTokenAmountProps) {
  const numArray = formatForDisplay(value);
  const previousNumber = usePrevious(value);

  let delta: string | null = null;
  if (previousNumber !== undefined) {
    if (value > previousNumber) delta = "increase";
    if (value < previousNumber) delta = "decrease";
  }

  return (
    <motion.div layout className="ticker-view">
      {numArray.map((number, index) =>
        number === "." ? (
          <DecimalColumn key={index} />
        ) : (
          <NumberColumn key={index} digit={number} delta={delta} />
        )
      )}
    </motion.div>
  );
}