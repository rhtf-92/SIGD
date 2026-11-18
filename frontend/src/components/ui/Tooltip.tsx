import {
  useState,
  useId,
  type ReactNode,
} from "react";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  className?: string;
}

const POSITION_CLASSES: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({
  content,
  children,
  position = "top",
  className = "",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  const show = () => setIsVisible(true);
  const hide = () => setIsVisible(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          hide();
        }
      }}
    >
      <span aria-describedby={isVisible ? tooltipId : undefined}>
        {children}
      </span>

      {isVisible && content && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 pointer-events-none whitespace-normal rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-normal text-white shadow-lg animate-in fade-in zoom-in-95 duration-150 max-w-xs text-center ${POSITION_CLASSES[position]} ${className}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
