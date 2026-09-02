import { BuyButton, PaywallAutoVerify, RestoreAccessButton } from "./paywall-actions";

// Placeholder pricing — /iblai-vibe-monetization-app-paywall Step 1 fills this
// (and re-running it refreshes the display data). The page is unlinked and the
// paywall inert until that skill wires the env and the (app) layout gate.
// ponytail: display data duplicated from Stripe; charging uses only priceId.
const PRICES: { priceId: string; name: string; amount: string; interval: string | null }[] = [
  { priceId: "price_REPLACE_ME", name: "Full access", amount: "$29", interval: "month" },
];

export default function PaywallPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <PaywallAutoVerify />
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="bg-gradient-to-r from-[#00b0ef] to-[#0058cc] bg-clip-text text-4xl font-bold text-transparent">
          Unlock this app
        </h1>
        <p className="text-sm text-muted-foreground">
          Pay once (or subscribe) to get full access with your account.
        </p>
        <div className="flex flex-col gap-4">
          {PRICES.map((p) => (
            <div
              key={p.priceId}
              className="space-y-3 rounded-lg border border-border bg-background p-6"
            >
              <p className="text-sm font-medium text-foreground">{p.name}</p>
              <p className="text-3xl font-bold text-foreground">
                {p.amount}
                {p.interval && (
                  <span className="text-sm font-normal text-muted-foreground">/{p.interval}</span>
                )}
              </p>
              <BuyButton priceId={p.priceId} />
            </div>
          ))}
        </div>
        <RestoreAccessButton />
      </div>
    </main>
  );
}
