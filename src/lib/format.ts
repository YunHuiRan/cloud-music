export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatCount(count: number, unit = "首"): string {
  return `${count.toLocaleString("zh-CN")} ${unit}`;
}

export function artistLine(artists: string[]): string {
  return artists.join(" & ");
}

export function normalizeQuery(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const COVER_PALETTES: Array<[string, string]> = [
  ["#4f7cff", "#7b61ff"],
  ["#3d66e8", "#8b7cff"],
  ["#7b61ff", "#4f7cff"],
  ["#22c55e", "#4f7cff"],
  ["#ff6b6b", "#7b61ff"],
  ["#4f7cff", "#22c55e"],
  ["#2dd4bf", "#4f7cff"],
  ["#8b5cf6", "#4f7cff"],
  ["#6366f1", "#22c55e"],
  ["#4f7cff", "#8b5cf6"],
];

export function coverStyle(seed: string): { backgroundImage: string } {
  const hash = hashString(seed);
  const [first, second] = COVER_PALETTES[hash % COVER_PALETTES.length];
  return {
    backgroundImage: `radial-gradient(120% 90% at 18% 6%, rgba(255, 255, 255, 0.3), transparent 54%), linear-gradient(140deg, ${first}, ${second})`,
  };
}
