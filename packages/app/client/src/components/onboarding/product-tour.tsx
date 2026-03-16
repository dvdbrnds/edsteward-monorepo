import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles
} from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  target: string | null;
  placement: 'bottom' | 'top' | 'left' | 'right' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to EdSteward',
    description: 'Let\'s take a quick tour of your compliance portal. We\'ll walk through the key areas so you know where everything is.',
    target: null,
    placement: 'center',
  },
  {
    title: 'Dashboard',
    description: 'Your home base. See overdue tasks, upcoming deadlines, compliance scores, and recent activity at a glance. Widgets are draggable — arrange them however you like.',
    target: '[data-tour="nav-dashboard"]',
    placement: 'bottom',
  },
  {
    title: 'Notifications',
    description: 'The red badge shows overdue compliance tasks. Click here to see all alerts, due-soon reminders, and regulation change notifications.',
    target: '[data-tour="nav-notifications"]',
    placement: 'bottom',
  },
  {
    title: 'Regulation Updates',
    description: 'When the MCP Engine detects regulation changes, they appear here for your review. You can approve, reject, or defer each update before it affects your compliance tasks.',
    target: '[data-tour="nav-reg-updates"]',
    placement: 'bottom',
  },
  {
    title: 'Your Regulations',
    description: 'Below the dashboard, you\'ll find your full regulation list. Each regulation has compliance tasks, deadlines, evidence requirements, and an attestation workflow. Click any regulation to see its detail page.',
    target: '[data-tour="nav-dashboard"]',
    placement: 'bottom',
  },
  {
    title: 'You\'re All Set',
    description: 'That covers the essentials. Open any regulation to send attestation requests, upload evidence, and manage compliance tasks. You can replay this tour anytime from Account Settings.',
    target: null,
    placement: 'center',
  },
];

const STORAGE_KEY = 'edsteward-tour-completed';
const SPOTLIGHT_PADDING = 8;

export function ProductTour() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const positionTooltip = useCallback(() => {
    const current = TOUR_STEPS[step];
    if (!current.target) {
      setSpotlightRect(null);
      setTooltipPos(null);
      return;
    }

    const el = document.querySelector(current.target);
    if (!el) {
      setSpotlightRect(null);
      setTooltipPos(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setSpotlightRect(rect);

    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl?.offsetWidth || 340;
    const tooltipHeight = tooltipEl?.offsetHeight || 160;

    let top = 0;
    let left = 0;

    switch (current.placement) {
      case 'bottom':
        top = rect.bottom + SPOTLIGHT_PADDING + 8;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = rect.top - SPOTLIGHT_PADDING - 8 - tooltipHeight;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + SPOTLIGHT_PADDING + 8;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - SPOTLIGHT_PADDING - 8 - tooltipWidth;
        break;
    }

    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12));

    setTooltipPos({ top, left });
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    positionTooltip();

    window.addEventListener('resize', positionTooltip);
    window.addEventListener('scroll', positionTooltip, true);
    return () => {
      window.removeEventListener('resize', positionTooltip);
      window.removeEventListener('scroll', positionTooltip, true);
    };
  }, [visible, step, positionTooltip]);

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;
  const isCentered = !current.target || !spotlightRect;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  const next = () => {
    if (isLast) dismiss();
    else setStep(s => s + 1);
  };

  const prev = () => {
    if (!isFirst) setStep(s => s - 1);
  };

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'auto' }}>
      {/* Overlay with spotlight cutout */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left - SPOTLIGHT_PADDING}
                y={spotlightRect.top - SPOTLIGHT_PADDING}
                width={spotlightRect.width + SPOTLIGHT_PADDING * 2}
                height={spotlightRect.height + SPOTLIGHT_PADDING * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0"
          width="100%" height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Spotlight ring highlight */}
      {spotlightRect && (
        <div
          className="absolute border-2 border-blue-400 rounded-lg pointer-events-none animate-pulse"
          style={{
            top: spotlightRect.top - SPOTLIGHT_PADDING,
            left: spotlightRect.left - SPOTLIGHT_PADDING,
            width: spotlightRect.width + SPOTLIGHT_PADDING * 2,
            height: spotlightRect.height + SPOTLIGHT_PADDING * 2,
            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.25)',
          }}
        />
      )}

      {/* Click blocker (covers everything except the spotlight area) */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5 w-[340px] animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={
          isCentered
            ? {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }
            : tooltipPos
              ? { top: tooltipPos.top, left: tooltipPos.left }
              : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        }
      >
        {/* Arrow for non-centered tooltips */}
        {!isCentered && current.placement === 'bottom' && spotlightRect && (
          <div
            className="absolute -top-2 w-4 h-4 bg-white dark:bg-gray-900 border-l border-t border-gray-200 dark:border-gray-700 rotate-45"
            style={{
              left: Math.max(20, Math.min(
                (spotlightRect.left + spotlightRect.width / 2) - (tooltipPos?.left || 0),
                300
              )),
            }}
          />
        )}

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {isCentered && <Sparkles className="h-5 w-5 text-blue-500" />}
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{current.title}</h3>
          </div>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 -mt-1 -mr-1 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
          {current.description}
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-5 bg-blue-600' : i < step ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-gray-200 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={isFirst}
            className={`text-xs ${isFirst ? 'invisible' : ''}`}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
            Back
          </Button>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={dismiss} className="text-xs text-gray-500">
              Skip
            </Button>
            <Button size="sm" onClick={next} className="text-xs">
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function resetProductTour() {
  localStorage.removeItem(STORAGE_KEY);
}
