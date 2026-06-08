// Deterministic playful avatar picker. 12 illustrated avatars live at
// /icons/custom/avatars/avatar-1.png .. avatar-12.png. Given a stable seed
// (user id, email, or name) the same person always gets the same avatar.

export const AVATAR_COUNT = 12;

export function avatarFor(seed: string | null | undefined): string {
  const s = (seed ?? "").trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const n = (h % AVATAR_COUNT) + 1;
  return `/icons/custom/avatars/avatar-${n}.png`;
}
