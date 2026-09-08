import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name = "ED") {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function shortDate(value?: string) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    : "—";
}

export function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString("en-IN");
}
