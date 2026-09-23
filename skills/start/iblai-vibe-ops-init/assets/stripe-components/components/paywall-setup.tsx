"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  OnboardingShell,
  StepHeader,
  onboardingPrimaryButtonClass,
  onboardingSecondaryButtonClass,
} from "@iblai/iblai-js/web-containers";
import { LoadingScreen } from "@/components/loading-screen";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isTenantAdmin } from "@/lib/iblai/tenant";
import {
  PaywallRequestError,
  connectFailure,
  errorMessage,
  fetchCatalogue,
  invalidateCatalogue,
  markSetupDone,
  paywallFetch,
  setupMessage,
  sourceWarning,
  type Access,
  type ConnectStatus,
} from "@/lib/paywall-client";

export type SetupStep = "access" | "connect";

const OPTIONS: { value: Access; title: string; detail: string }[] = [
  { value: "free", title: "Free access", detail: "Anyone signed in can use the app." },
  { value: "one_time", title: "One-time fee", detail: "Pay once, keep access." },
  { value: "monthly", title: "Monthly fee", detail: "A subscription, cancelled any time." },
];

/** A card that reads as a radio, the shape the starter's own /setup uses. */
const cardClass = (selected: boolean) =>
  cn(
    "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-xl border p-4 text-left transition-all focus-within:ring-2 focus-within:ring-[#2563EB]",
    selected
      ? "border-[#2563EB] bg-[#2563EB]/[0.06] ring-1 ring-[#2563EB]"
      : "border-gray-200 hover:border-gray-300",
  );

const CONNECT_ROUTE = "/api/paywall/admin/connect";
const SETUP_ROUTE = "/api/paywall/admin/setup";
/** The answer in progress survives the round trip to Stripe here; cleared after the save. */
const PENDING_KEY = "paywall_setup_pending";
const stepPath = (step: SetupStep) =>
  step === "connect" ? "/paywall/setup/connect" : "/paywall/setup";
/** The platform checks every member's access on the Stripe source, so unlinking locks them out. */
const LOCKOUT =
  "Members can’t get into the app until a Stripe account is linked again. To stop charging instead, choose Free access and save.";

type Pending = { access: Access; amount: string };

/** `?stripe_connect=connected|error&reason=…`: how the platform's callback lands the admin back here. */
function readReturn(): { result: string; reason: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const result = params.get("stripe_connect");
  return result ? { result, reason: params.get("reason") ?? "" } : null;
}

function readPending(): Pending | null {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
  } catch {
    return null;
  }
}

/**
 * The paywall's own setup, two steps in one component: how people get in (free,
 * a one-time fee or a monthly fee, USD) and — for a paid answer while the
 * organization has no Stripe source — Connect with Stripe (the platform's own
 * OAuth: the admin signs in on Stripe and comes back to /paywall/setup/connect).
 * Nothing is typed or copied. Save lets /api/paywall/admin/setup create the
 * product and price on that account and record the choice. Every call runs on
 * the admin's own token; the platform answers 403 to anyone else, and this
 * screen says so first.
 */
export function PaywallSetup({ step }: { step: SetupStep }) {
  const router = useRouter();
  // Read once on the client: the providers hold this tree until mounted.
  const [admin] = useState(isTenantAdmin);
  const [returned] = useState(readReturn);
  const [access, setAccess] = useState<Access | null>(null);
  const [amount, setAmount] = useState("29");
  /** Something is for sale right now — what unlinking Stripe would lock members out of. */
  const [selling, setSelling] = useState(false);
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  /** The arrival work is done: the saved answer and the Stripe source are in. */
  const [loaded, setLoaded] = useState(false);
  /** The overlay's message while the page is busy; "" when it is not. */
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadStatus = () =>
    paywallFetch<ConnectStatus>(CONNECT_ROUTE).then((s) => {
      setStatus(s);
      return s;
    });

  const save = async (chosen: Access, price: string) => {
    const paid = chosen !== "free";
    setBusy("Saving…");
    setError("");
    try {
      await paywallFetch(SETUP_ROUTE, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        json: { access: chosen, ...(paid && { amount: Math.round(Number(price) * 100) }) },
      });
      sessionStorage.removeItem(PENDING_KEY);
      invalidateCatalogue();
      markSetupDone();
      router.replace("/");
    } catch (e) {
      setError(setupMessage(e));
      setBusy("");
    }
  };

  // Once, on arrival: the saved answer, the Stripe source, and — back from
  // Stripe — the outcome, saving the answer in progress when it connected.
  useEffect(() => {
    if (!admin) return;
    // The answer in progress, stashed before leaving for the step next door or
    // for Stripe. Consumed on the question, kept on the Stripe step: that one
    // still needs it when the consent page returns.
    const pending = readPending();
    if (pending) {
      setAccess(pending.access);
      setAmount(pending.amount);
      if (step === "access") sessionStorage.removeItem(PENDING_KEY);
    }
    // Back from Stripe's consent page: drop the query so a reload does not replay it.
    if (returned) router.replace(stepPath(step));
    if (returned?.result === "error") setError(connectFailure(returned.reason));
    void (async () => {
      try {
        const [catalogue, source] = await Promise.all([fetchCatalogue(), loadStatus()]);
        setSelling(catalogue.paywall);
        if (!pending && catalogue.settings) {
          setAccess(catalogue.settings.access);
          if (catalogue.settings.amount) setAmount(String(catalogue.settings.amount / 100));
        }
        if (returned?.result === "connected" && pending && pending.access !== "free")
          await save(pending.access, pending.amount);
        // A source and nothing waiting to be saved: the question is where to go on.
        else if (step === "connect" && source.source) router.replace(stepPath("access"));
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        // Whatever happened, the step may now be drawn — spinning forever would
        // hide the error that was just set.
        setLoaded(true);
      }
    })();
    // Once, on mount: `step`, `returned`, `admin` and `router` do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paid = access === "one_time" || access === "monthly";
  const connectMissing = paid && status?.source === null;
  const cents = Math.round(Number(amount) * 100);
  const priceValid = !paid || (Number.isFinite(cents) && cents > 0);

  /** Keep the answer in progress across the step next door, and the trip to Stripe. */
  const stashPending = () => {
    if (access)
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ access, amount } satisfies Pending));
  };

  const onQuestionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!access) return;
    if (!priceValid) {
      setError("Enter a price greater than zero.");
      return;
    }
    setError("");
    if (connectMissing) {
      stashPending();
      router.push(stepPath("connect"));
      return;
    }
    await save(access, amount);
  };

  /** Leave for Stripe's consent page; an answer in progress rides along for the return. */
  const startConnect = async () => {
    stashPending();
    setBusy("Redirecting to Stripe…");
    setError("");
    try {
      const { authorize_url } = await paywallFetch<{ authorize_url?: string }>(CONNECT_ROUTE, {
        method: "POST",
        // Stripe's consent returns to the step that sent them there: this one
        // holds the retry button, and a failure has to show where it can be
        // acted on.
        json: { return_url: `${window.location.origin}${stepPath("connect")}` },
      });
      if (!authorize_url) throw new Error("The platform answered without Stripe’s address.");
      window.location.href = authorize_url;
    } catch (e) {
      // Connected after all (another tab, an earlier round trip): go on.
      if (e instanceof PaywallRequestError && e.status === 409) {
        loadStatus().catch((err: unknown) => setError(setupMessage(err)));
        if (access) await save(access, amount);
        else setBusy("");
        return;
      }
      setError(setupMessage(e));
      // A reconnect has already disconnected by now: show where things stand.
      loadStatus().catch(() => {});
      setBusy("");
    }
  };

  /** Unlinking while something is for sale locks members out; say so first. */
  const lockoutAccepted = (question: string) =>
    !selling || window.confirm(`${question} ${LOCKOUT}`);

  /** The platform's 502 on a disconnect means Stripe could not confirm it: still connected. */
  const disconnectMessage = (e: unknown) =>
    e instanceof PaywallRequestError && e.status === 502
      ? "Stripe could not be reached; the account is still connected. Try again."
      : setupMessage(e);

  const disconnect = async () => {
    if (!lockoutAccepted("Disconnect this Stripe account?")) return;
    setBusy("Disconnecting…");
    setError("");
    try {
      await paywallFetch(CONNECT_ROUTE, { method: "DELETE" });
    } catch (e) {
      setError(disconnectMessage(e));
    }
    await loadStatus().catch(() => {});
    setBusy("");
  };

  /**
   * Another Stripe account (or the same one after revoking ibl.ai on Stripe):
   * disconnect, then the same round trip as Connect with Stripe; the return
   * re-saves a paid answer on the new account.
   */
  const reconnect = async () => {
    if (!lockoutAccepted("Link a different Stripe account? This one is disconnected first."))
      return;
    setBusy("Redirecting to Stripe…");
    setError("");
    try {
      await paywallFetch(CONNECT_ROUTE, { method: "DELETE" });
    } catch (e) {
      setError(disconnectMessage(e));
      setBusy("");
      return;
    }
    await startConnect();
  };

  const back = () => {
    setError("");
    router.push(stepPath("access"));
  };

  if (!admin)
    return (
      <OnboardingShell totalSteps={1} currentStep={1}>
        <p role="alert" className="text-sm text-destructive">
          Only organization admins can set up payments.
        </p>
      </OnboardingShell>
    );

  // Nothing paints before it can: a question that rearranges itself as its
  // answers arrive reads as a glitch. An error is the way out.
  if (!loaded && !error) return <LoadingScreen />;

  const errorLine = error && (
    <p role="alert" className="mt-4 text-sm text-destructive">
      {error}
    </p>
  );
  const warning = paid ? sourceWarning(status) : "";
  const account = status?.business_name || status?.email || status?.account_id;

  return (
    <OnboardingShell
      totalSteps={step === "connect" || connectMissing ? 2 : 1}
      currentStep={step === "connect" ? 2 : 1}
    >
      {/* Saving = creating the product and price; redirecting = leaving for
          Stripe: the page is busy and nothing here should be touched. */}
      {busy && <LoadingScreen overlay message={busy} />}
      {step === "access" && (
        <form onSubmit={onQuestionSubmit}>
          <StepHeader
            title="How should people get in?"
            subtitle="Free, or charge for access. You can change this any time."
          />
          <fieldset className="space-y-3">
            <legend className="sr-only">Access</legend>
            {OPTIONS.map((option) => {
              const selected = access === option.value;
              return (
                <label key={option.value} className={cardClass(selected)}>
                  <input
                    type="radio"
                    name="access"
                    value={option.value}
                    checked={selected}
                    onChange={() => setAccess(option.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-900">{option.title}</span>
                  <span className="text-sm text-gray-500">{option.detail}</span>
                </label>
              );
            })}
          </fieldset>

          {paid && (
            <div className="mt-5 space-y-2">
              <Label htmlFor="price">
                {access === "monthly" ? "Price per month" : "Price"} (USD)
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="price"
                  type="number"
                  min="0.5"
                  step="0.01"
                  inputMode="decimal"
                  className="pl-7"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          )}

          {errorLine}
          <button
            type="submit"
            disabled={!access || !!busy || (paid && !status)}
            className={`mt-6 ${onboardingPrimaryButtonClass}`}
          >
            {connectMissing ? "Continue" : "Save"}
          </button>
          {status?.source === "connected" && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Stripe account connected · {account}
              {status.livemode === false ? " (test mode)" : ""}
              {" · "}
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={reconnect}
              >
                Reconnect
              </button>
              {" · "}
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={disconnect}
              >
                Disconnect
              </button>
            </p>
          )}
          {status?.source === "connected" && status.charges_enabled === false && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Stripe has not enabled payments on this account yet; finish setting it up in Stripe.
            </p>
          )}
          {status?.source === "key" && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Payments use this organization’s own Stripe key, set on ibl.ai.
            </p>
          )}
          {warning && (
            <p role="alert" className="mt-2 text-center text-xs text-destructive">
              {warning}
            </p>
          )}
          {status && !status.source && !status.available && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Connect with Stripe is not available on this platform yet.
            </p>
          )}
        </form>
      )}
      {step === "connect" && (
        <div>
          <StepHeader
            title="Monetize Your App"
            subtitle="Connect your Stripe account. Payments go straight to it; nothing to copy."
          />
          {errorLine}
          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={!!busy}
              className={onboardingPrimaryButtonClass}
              onClick={startConnect}
            >
              Connect with Stripe
            </button>
            <button type="button" className={onboardingSecondaryButtonClass} onClick={back}>
              Back
            </button>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
