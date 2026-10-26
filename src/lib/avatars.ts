export const DEFAULT_AVATARS = [
  { id: "mic", src: "/avatars/mic.jpg", label: "麥克風" },
  { id: "bird", src: "/avatars/bird.jpg", label: "小鳥" },
  { id: "cat", src: "/avatars/cat.jpg", label: "耳機貓" },
  { id: "star", src: "/avatars/star.jpg", label: "星星" },
  { id: "fox", src: "/avatars/fox.jpg", label: "狐狸" },
  { id: "note", src: "/avatars/note.jpg", label: "音符" },
] as const;

export type DefaultAvatarId = (typeof DEFAULT_AVATARS)[number]["id"];

export const DEFAULT_AVATAR_SRC = DEFAULT_AVATARS[0].src;

export function resolveAvatarUrl(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) return DEFAULT_AVATAR_SRC;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }
  if (avatarUrl.startsWith("/")) return avatarUrl;
  // preset id e.g. "mic"
  const preset = DEFAULT_AVATARS.find((a) => a.id === avatarUrl);
  return preset?.src ?? DEFAULT_AVATAR_SRC;
}

export function isDefaultAvatarId(value: string): value is DefaultAvatarId {
  return DEFAULT_AVATARS.some((a) => a.id === value);
}
