import Link from "next/link";

interface LogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ href = "/", size = "md", className = "" }: LogoProps) {
  const iconSizes = {
    sm: "h-7 w-7 text-xs rounded-xl",
    md: "h-9 w-9 text-base rounded-2xl",
    lg: "h-11 w-11 text-xl rounded-2xl",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base sm:text-lg",
    lg: "text-xl sm:text-2xl",
  };

  const content = (
    <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      {/* 3D Heart Icon inside Glowing Squircle Frame */}
      <div
        className={`flex items-center justify-center shrink-0 border border-[#FF3D7F]/40 bg-gradient-to-br from-[#FF3D7F]/25 via-[#FF3D7F]/10 to-transparent shadow-[0_0_14px_#FF3D7F35] transition-all duration-300 group-hover:scale-105 group-hover:border-[#FF3D7F]/70 group-hover:shadow-[0_0_20px_#FF3D7F60] ${iconSizes[size]}`}
      >
        <span className="leading-none filter drop-shadow-[0_2px_4px_rgba(255,61,127,0.4)]">
          ❤️
        </span>
      </div>

      {/* Brand Name Text: LDR-Connect */}
      <span className={`font-black tracking-tight text-[#FFF5F8] ${textSizes[size]}`}>
        LDR<span className="text-[#FF3D7F]">-Connect</span>
      </span>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-block transition-transform active:scale-95">
      {content}
    </Link>
  );
}
