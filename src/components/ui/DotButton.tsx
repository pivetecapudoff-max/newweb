import React, { ReactNode } from "react";

export interface DotButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  wrapperClassName?: string;
  dotColor?: string;
  lineColor?: string;
  gridColor?: string;
  asAnchor?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export function DotButton({
  children,
  className = "",
  wrapperClassName = "",
  dotColor,
  lineColor,
  gridColor,
  asAnchor = false,
  href,
  target,
  rel,
  style,
  ...props
}: DotButtonProps) {
  const customStyles: React.CSSProperties = {
    ...(dotColor ? ({ "--dot-color": dotColor } as any) : {}),
    ...(lineColor ? ({ "--line-color": lineColor } as any) : {}),
    ...(gridColor ? ({ "--grid-color": gridColor } as any) : {}),
  };

  const isDisabled = props.disabled;

  return (
    <div
      className={`dot-btn-wrapper ${isDisabled ? "opacity-50 pointer-events-none" : ""} ${wrapperClassName}`}
      style={customStyles}
    >
      <div className="line horizontal top" />
      <div className="line vertical right" />
      <div className="line horizontal bottom" />
      <div className="line vertical left" />

      <div className="dot top left" />
      <div className="dot top right" />
      <div className="dot bottom right" />
      <div className="dot bottom left" />

      {asAnchor ? (
        <a
          href={href}
          target={target}
          rel={rel}
          className={`relative z-10 flex items-center justify-center transition-all duration-200 active:scale-[0.98] cursor-pointer ${className}`}
          style={style}
        >
          {children}
        </a>
      ) : (
        <button
          className={`relative z-10 flex items-center justify-center transition-all duration-200 active:scale-[0.98] ${
            isDisabled ? "cursor-not-allowed" : "cursor-pointer"
          } ${className}`}
          style={style}
          {...props}
        >
          {children}
        </button>
      )}
    </div>
  );
}

export default DotButton;
