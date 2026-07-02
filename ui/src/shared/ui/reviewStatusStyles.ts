import type { ReviewQueueStatus } from "../types/review";

type ReviewStatusStyle = {
  badge: string;
  iconBadge: string;
  dot: string;
  text: string;
  progress: string;
};

export const reviewSummaryStatusStyles = {
  teBeoordelen: {
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    iconBadge: "border-sky-200 bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
    text: "text-sky-800",
    progress: "bg-sky-500",
  },
  akkoord: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconBadge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    text: "text-emerald-800",
    progress: "bg-emerald-500",
  },
  retour: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    iconBadge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    text: "text-amber-800",
    progress: "bg-amber-500",
  },
  uitgesloten: {
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    iconBadge: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
    text: "text-rose-800",
    progress: "bg-rose-500",
  },
  uitgesteld: {
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    iconBadge: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
    text: "text-slate-700",
    progress: "bg-slate-400",
  },
} as const satisfies Record<string, ReviewStatusStyle>;

export function getReviewQueueStatusStyle(status: ReviewQueueStatus): ReviewStatusStyle {
  switch (status) {
    case "afgerond":
      return reviewSummaryStatusStyles.akkoord;
    case "retour":
      return reviewSummaryStatusStyles.retour;
    case "conflict":
      return reviewSummaryStatusStyles.uitgesloten;
    case "uitgesteld":
      return reviewSummaryStatusStyles.uitgesteld;
    default:
      return reviewSummaryStatusStyles.teBeoordelen;
  }
}
