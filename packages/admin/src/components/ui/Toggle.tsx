// packages/admin/src/components/ui/Toggle.tsx
import React, { useState } from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';

interface ToggleProps {
  name: string;
  label: string;
  defaultPressed?: boolean;
  /** Optional label to show when toggle is off (if not provided, uses the main label) */
  labelOff?: string;
  /** Optional id for the toggle container */
  containerId?: string;
  /** Hide the visible label while keeping aria-label */
  labelHidden?: boolean;
}

export const Toggle = ({
  name,
  label,
  defaultPressed = false,
  labelOff,
  containerId,
  labelHidden = false
}: ToggleProps) => {
  const [pressed, setPressed] = useState(defaultPressed);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isFirstRender = React.useRef(true);
  
  // Determine which label to show
  const displayLabel = pressed ? label : (labelOff || label);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (inputRef.current) {
      // Store pressed state on the element for easy access
      if (containerRef.current) {
        (containerRef.current as any).pressed = pressed;
      }
      inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, [pressed]);

  // Initialize pressed property on mount
  React.useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).pressed = pressed;
    }
  }, []);

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    // Avoid double-toggling when clicking the Radix toggle button itself:
    // the event bubbles to the container, so we only handle clicks outside the toggle root.
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('.toggle-root')) return;
    setPressed((p) => !p);
  }

  return (
    <div
      ref={containerRef}
      id={containerId}
      className="flex items-center gap-4 group cursor-pointer"
      onClick={handleContainerClick}
    >
      <div className="relative flex items-center">
        <TogglePrimitive.Root
          pressed={pressed}
          onPressedChange={setPressed}
          // Using !bg to ensure it overrides any potential default button styles
          className={`
            toggle-root
            relative flex items-center w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-admin-primary-bright focus:ring-offset-2 focus:ring-offset-admin-bg
            ${pressed 
              ? '!bg-admin-bg shadow-[0_0_15px_rgba(1,237,249,0.5)]' 
              : 'bg-admin-sidebar border-2 border-admin-primary-light/30 group-hover:border-admin-primary-light/60'}
          `}
          aria-label={label}
        >
          <div 
            className={`
              toggle-thumb
              absolute w-4 h-4 rounded-full transition-all duration-300 ease-in-out shadow-sm
              ${pressed ? 'left-[26px] bg-admin-success' : 'left-[4px] bg-white'}
            `}
          />
        </TogglePrimitive.Root>
      </div>
      <span
        className={`text-sm font-medium text-admin-text group-hover:text-white transition-colors select-none ${
          labelHidden ? 'sr-only' : 'min-w-[90px]'
        }`}
      >
        {displayLabel}
      </span>
      <input ref={inputRef} type="hidden" name={name} value={pressed ? 'on' : ''} />
    </div>
  );
};
