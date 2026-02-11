import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={`
        shadow-lg rounded-lg p-4 border
        grid grid-cols-[auto_max-content] gap-x-4 items-center
        data-[state=open]:animate-in data-[state=closed]:animate-out
        data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
        data-[swipe=cancel]:translate-x-0
        data-[swipe=end]:animate-out
        data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-full data-[state=closed]:zoom-out-95
        data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-full data-[state=open]:zoom-in-95
        duration-300
        ${className}
      `}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitive.Root.displayName;

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={`text-sm font-semibold ${className}`}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={`text-sm opacity-90 ${className}`}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

interface ToastEventDetail {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning';
  action?: {
    label: string;
    onClick: () => void;
  };
  progress?: number;
  persist?: boolean;
}

export function Toaster() {
  const [open, setOpen] = React.useState(false);
  const [toastData, setToastData] = React.useState<ToastEventDetail>({ title: '' });

  React.useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastEventDetail>;
      setToastData(customEvent.detail);
      setOpen(true);
    };

    const handleToastUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<Partial<ToastEventDetail>>;
      setToastData(prev => ({ ...prev, ...customEvent.detail }));
    };

    window.addEventListener('artsitemaker:toast', handleToast);
    window.addEventListener('artsitemaker:toast:update', handleToastUpdate);
    return () => {
      window.removeEventListener('artsitemaker:toast', handleToast);
      window.removeEventListener('artsitemaker:toast:update', handleToastUpdate);
    };
  }, []);

  const variantStyles = {
    default: 'bg-admin-card text-admin-text border-admin-border',
    success: 'bg-admin-card border-admin-success text-admin-text shadow-[0_0_15px_rgba(74,222,128,0.3)]',
    destructive: 'bg-admin-card border-admin-error text-admin-text shadow-[0_0_15px_rgba(239,68,68,0.3)]',
    warning: 'bg-admin-card border-admin-warning text-admin-text shadow-[0_0_15px_rgba(251,191,36,0.3)]',
  };

  const progressValue = toastData.progress;
  const hasProgress = progressValue !== undefined;
  const isComplete = hasProgress && progressValue >= 100;
  const duration = toastData.persist ? Infinity : isComplete ? 3000 : 10000;

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={duration}>
      <Toast 
        open={open} 
        onOpenChange={setOpen}
        className={variantStyles[toastData.variant || 'default']}
      >
        <div className="grid gap-2 flex-1">
          {toastData.title && <ToastTitle>{toastData.title}</ToastTitle>}
          {toastData.description && (
            <ToastDescription>{toastData.description}</ToastDescription>
          )}
          {hasProgress && (
            <div className="mt-1">
              <div className="h-2 bg-admin-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-admin-accent transition-all duration-300 ease-out"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              <div className="text-xs text-admin-muted mt-1 text-right">
                {toastData.progress}%
              </div>
            </div>
          )}
          {toastData.action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toastData.action?.onClick();
                setOpen(false);
              }}
              className="text-xs text-admin-accent hover:text-admin-text underline mt-1 text-left"
            >
              {toastData.action.label} →
            </button>
          )}
        </div>
        <ToastPrimitive.Close className="rounded-md hover:opacity-75 focus:outline-none focus:ring-2 group-hover:opacity-100 self-start">
          <X className="h-4 w-4" />
        </ToastPrimitive.Close>
      </Toast>
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 gap-[10px] w-[390px] max-w-[100vw] m-0 list-none z-[100] outline-none p-4" />
    </ToastPrimitive.Provider>
  );
}
