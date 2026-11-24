import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

/** Temporary placeholder for pages that are built in a later phase. */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
      <EmptyState icon={<Hammer size={22} />} title="Coming soon">
        {children}
      </EmptyState>
    </div>
  );
}
