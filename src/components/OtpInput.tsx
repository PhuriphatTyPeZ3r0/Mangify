import React, { useRef, useEffect } from "react";

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, disabled }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Split string into array of 6 elements, padded with empty string
  const values = Array.from({ length: 6 }, (_, i) => value[i] || "");

  // Auto focus first input on mount
  useEffect(() => {
    if (!disabled && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [disabled]);

  const handleChange = (val: string, index: number) => {
    const cleaned = val.replace(/\D/g, "");
    if (!cleaned) {
      // User deleted character
      const chars = [...values];
      chars[index] = "";
      const newVal = chars.filter(c => c !== "").join(""); // wait, standard joining:
      // When clearing, we want to clear this specific box without shifting others, so keep placeholders or join.
      // If we just construct a string of length 6:
      const updatedChars = [...values];
      updatedChars[index] = "";
      const finalVal = updatedChars.join("");
      onChange(finalVal);
      return;
    }

    // Take only the last typed character
    const char = cleaned[cleaned.length - 1];
    const updatedChars = [...values];
    updatedChars[index] = char;
    const finalVal = updatedChars.join("");
    onChange(finalVal);

    // Focus next input if available
    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!values[index]) {
        // Current field is empty: focus and delete previous field
        if (index > 0) {
          const updatedChars = [...values];
          updatedChars[index - 1] = "";
          const finalVal = updatedChars.join("");
          onChange(finalVal);
          inputRefs.current[index - 1]?.focus();
        }
      } else {
        // Current field has a character: just delete it
        const updatedChars = [...values];
        updatedChars[index] = "";
        const finalVal = updatedChars.join("");
        onChange(finalVal);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData) {
      onChange(pastedData);
      const nextFocus = Math.min(pastedData.length, 5);
      inputRefs.current[nextFocus]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center py-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={values[index]}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          onChange={(e) => handleChange(e.target.value, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className="w-10 h-12 md:w-12 md:h-14 text-center font-bold text-lg md:text-xl rounded-xl border border-border bg-background/50 backdrop-blur-xs text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all select-all disabled:opacity-50"
        />
      ))}
    </div>
  );
};
