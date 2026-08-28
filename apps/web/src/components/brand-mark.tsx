import {CalendarCheck2} from "lucide-react";

export function BrandMark({inverse = false}: {inverse?: boolean}) {
  return (
    <span
      className={`inline-flex size-9 items-center justify-center rounded-xl ${inverse ? "bg-white/12 text-white" : "bg-brand text-white"}`}
      aria-hidden="true"
    >
      <CalendarCheck2 className="size-5" strokeWidth={2.2} />
    </span>
  );
}
