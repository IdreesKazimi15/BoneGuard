'use client';

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({
  message = 'Processing radiograph...',
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 animate-fade-in">
      {/* Animated scanner rings */}
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border-2 border-accent/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-accent/40 animate-ping [animation-delay:0.2s]" />
        <div className="absolute inset-0 rounded-full border-2 border-t-accent border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        <div className="absolute inset-3 rounded-full border-2 border-b-accent-light border-r-transparent border-t-transparent border-l-transparent animate-spin [animation-duration:0.8s]" />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-accent animate-pulse-slow" />
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-white">{message}</p>
        <p className="text-xs text-slate-500">
          Running YOLOv8 detection + EfficientNet classification
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {['Preprocessing', 'Detection', 'Classification', 'Grad-CAM'].map(
          (step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-navy-500">›</span>}
              <span
                className="animate-pulse-slow"
                style={{ animationDelay: `${i * 0.4}s` }}
              >
                {step}
              </span>
            </span>
          )
        )}
      </div>
    </div>
  );
}
