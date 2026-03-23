export const COLOR_MAP: Record<
  string,
  { bg: string; text: string; dot: string; border: string; gradient: string }
> = {
  Red: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-500",
    border: "border-red-500/30",
    gradient: "from-red-500 to-red-600",
  },
  Blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    dot: "bg-blue-500",
    border: "border-blue-500/30",
    gradient: "from-blue-500 to-blue-600",
  },
  Green: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
    border: "border-emerald-500/30",
    gradient: "from-emerald-500 to-emerald-600",
  },
  Purple: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    dot: "bg-purple-500",
    border: "border-purple-500/30",
    gradient: "from-purple-500 to-purple-600",
  },
  Black: {
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    dot: "bg-gray-700",
    border: "border-gray-500/30",
    gradient: "from-gray-600 to-gray-700",
  },
  Yellow: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    dot: "bg-yellow-500",
    border: "border-yellow-500/30",
    gradient: "from-yellow-500 to-yellow-600",
  },
};

export function parseColors(color: string): string[] {
  if (!color) return [];
  return color
    .split(/[\s\/]+/)
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase())
    .filter((c) => c in COLOR_MAP);
}

export function getColorInfo(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.Black;
}
