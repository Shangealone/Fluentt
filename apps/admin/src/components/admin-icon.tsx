export type IconName = "home" | "users" | "book" | "mic" | "chat" | "research" | "arrow" | "clock" | "shield" | "chart" | "file" | "settings" | "algorithm";
const paths: Record<IconName, string> = {
  chart: "M3 3v18h18M7 16v-4M12 16V8M17 16V5",
  file: "M14 2H5v20h14V7ZM14 2v6h5M8 12h8M8 16h6",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
  algorithm: "M12 3v5M5 16v5M19 16v5M5 16V12h14v4M8 3h8v5H8ZM2 16h6v5H2ZM16 16h6v5h-6Z",
  home: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  book: "M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z",
  mic: "M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8",
  chat: "M21 11a8 8 0 0 1-8 8H5l-4 3V5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3ZM6 7h10M6 12h7",
  research: "M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M8 14h8",
  arrow: "M5 12h14M14 7l5 5-5 5",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6",
};
export function AdminIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
