import type { HTMLAttributes, ReactNode } from "react";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export default function PageContainer({ className = "", children, ...rest }: PageContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-7xl space-y-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}
