"use client";

import Image from "next/image";

type AvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZE_MAP = {
  xs: { px: 28, text: "text-[11px]", ring: "ring-1" },
  sm: { px: 32, text: "text-xs",     ring: "ring-1" },
  md: { px: 48, text: "text-base",   ring: "ring-2" },
  lg: { px: 64, text: "text-2xl",    ring: "ring-2" },
  xl: { px: 80, text: "text-3xl",    ring: "ring-2" },
};

/**
 * Avatar — menampilkan foto profil jika ada, fallback ke inisial huruf.
 * Dipakai di AppShell, Profile, Couple page, dll.
 */
export function Avatar({ name, avatarUrl, size = "md", className = "" }: AvatarProps) {
  const { px, text, ring } = SIZE_MAP[size];
  const initial = name?.[0]?.toUpperCase() ?? "?";

  const baseClass = `
    shrink-0 overflow-hidden rounded-full
    ${ring} ring-[#FBDCD5]
    flex items-center justify-center font-bold
    bg-[#FDF4F2]
    ${text} text-[#C84B31]
    ${className}
  `.trim();

  if (avatarUrl) {
    return (
      <div
        className={baseClass}
        style={{ width: px, height: px, minWidth: px }}
      >
        <Image
          src={avatarUrl}
          alt={name ?? "Avatar"}
          width={px}
          height={px}
          className="h-full w-full object-cover"
          unoptimized // Supabase storage URL tidak perlu next/image optimization
        />
      </div>
    );
  }

  return (
    <div
      className={baseClass}
      style={{ width: px, height: px, minWidth: px }}
    >
      {initial}
    </div>
  );
}
