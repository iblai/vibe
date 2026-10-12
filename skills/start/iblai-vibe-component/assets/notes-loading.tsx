import { LoadingScreen } from "@/components/loading-screen";

export default function Loading() {
  return <LoadingScreen />;
}

export function SavingOverlay() {
  return <LoadingScreen overlay message="Saving…" />;
}
