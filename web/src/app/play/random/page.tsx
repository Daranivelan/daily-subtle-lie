import { RunShell } from "@/components/RunShell";

export default function RandomPlayPage() {
  return (
    <RunShell endpoint="/api/modes/random/today" title="Random Lie" />
  );
}
