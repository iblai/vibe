"use client";
import { ChatWidget } from "@/components/iblai/chat-widget";
import { config } from "@/lib/config";

export default function Home() {
  return (
    <ChatWidget
      mentorId={config.defaultAgentId()}
      width="100vw"
      height="calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
    />
  );
}
