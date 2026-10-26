import Image from "next/image";
import { cn } from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/avatars";

type Props = {
  avatarUrl?: string | null;
  username?: string;
  size?: number;
  className?: string;
};

export function UserAvatar({
  avatarUrl,
  username,
  size = 36,
  className,
}: Props) {
  const src = resolveAvatarUrl(avatarUrl);
  return (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full ring-2 ring-amber-400/30 bg-white/10",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={username ? `${username} 的頭像` : "用戶頭像"}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        unoptimized={src.startsWith("http")}
      />
    </span>
  );
}
