# The files, in full
The drop-in bodies of every asset `/iblai-vibe-house-journeys` ships under `assets/`, for an
install that stripped them — identical content, generated from the assets. Code fences use
`text` so the render gate reads them here and typechecks the real files instead.

## `lib/iblai/house-journeys.ts`

```text
/**
 * The three first-run journeys of an ibl.ai official app
 * (/iblai-vibe-house-journeys): the pure rules behind the organization
 * preview, the trial-gated shell, the credit badge and the first-run gate.
 * Only `config` and localStorage, so the unit test runs in node.
 */
// Relative import (not @/): vitest resolves no alias for lib files.
import config from "./config";

/** One organization of the signed-in user, as the sign-in stores them (`tenants`). */
export type OrgEntry = {
  key: string;
  is_admin?: boolean;
  show_paywall?: boolean | null;
  org?: string;
  name?: string;
  platform_name?: string;
};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The organizations the sign-in handed the browser (`tenants`), or [] when signed out. */
export function readTenants(): OrgEntry[] {
  try {
    const parsed = JSON.parse(storage()?.getItem("tenants") ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readUserData(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(storage()?.getItem("userData") ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const readUsername = (): string => String(readUserData().user_nicename ?? "");
export const readUserEmail = (): string => String(readUserData().user_email ?? "");

/** The community organization every account belongs to. */
export const mainOrg = (): string => config.mainTenantKey() || "main";

/**
 * The organization a signed-in user works in when the URL names none: the
 * stored one unless it is the community one, else the first other one they
 * belong to, else the community one itself — the OS's experience for a user
 * whose only organization is `main`.
 */
export function ownOrg(stored: string, tenants: ReadonlyArray<OrgEntry>, main = mainOrg()): string {
  if (stored && stored !== main && tenants.some((t) => t.key === stored)) return stored;
  return tenants.find((t) => t.key && t.key !== main)?.key ?? main;
}

export type Entry = {
  /** `enter` one of theirs, `main` the community one, `preview` one they do not belong to. */
  kind: "enter" | "main" | "preview";
  /** The organization the app runs on. */
  org: string;
  /** The organization previewed, when `kind` is `preview`. */
  preview?: string;
};

/**
 * Where a signed-in user works. A route organization they belong to is
 * entered; one they do not is previewed, with the app running on their own
 * organization underneath — so the SDK never attempts a join from a link.
 * With no organizations stored yet the route is trusted (the SDK decides).
 */
export function decideEntry({
  routeOrg,
  stored,
  tenants,
  main = mainOrg(),
}: {
  routeOrg: string;
  stored: string;
  tenants: ReadonlyArray<OrgEntry>;
  main?: string;
}): Entry {
  if (tenants.length === 0) {
    const org = routeOrg || stored || main;
    return { kind: org === main ? "main" : "enter", org };
  }
  const own = ownOrg(stored, tenants, main);
  if (routeOrg && !tenants.some((t) => t.key === routeOrg)) {
    return { kind: "preview", org: own, preview: routeOrg };
  }
  const org = routeOrg || own;
  return { kind: org === main ? "main" : "enter", org };
}

/** The OS's free-trial rule: on the community organization, not its admin, and in no other. */
export function isTrialUser(org: string, tenants: ReadonlyArray<OrgEntry>, main = mainOrg()): boolean {
  return org === main && tenants.length === 1 && tenants[0]?.key === main && !tenants[0]?.is_admin;
}

/** The login page with this app nested inside — where the platform returns a user after a checkout. */
export function loginReturnUrl(origin: string, app = "mentor"): string {
  return `${config.authUrl()}/login?app=${encodeURIComponent(app)}&redirect-to=${encodeURIComponent(origin)}`;
}

/**
 * ibl.ai's own $0 sign-up — the checkout `ibl.ai/join` resolves to — told to
 * come back here. The platform merges its return parameters into
 * `redirect_url` without disturbing the nested address, the login page signs
 * the new organization's admin in and hands back to the app; a cancelled
 * checkout returns the same way to where they were. The email prefills and
 * locks the checkout, so the new organization attaches to this account.
 */
export function createOrganizationUrl(origin: string, email = "", app = "mentor"): string {
  const back = loginReturnUrl(origin, app);
  const params = new URLSearchParams({ redirect_url: back, cancel_url: back });
  if (email) params.set("email", email);
  return `${config.dmUrl()}/api/service/stripe/checkout/redirect/credits-free-plan/?${params}`;
}

export type OnboardingFlow = "admin" | "user";

/**
 * Which flow /onboarding runs — the LMS's rule. Members get the member flow;
 * admins get it too by default (it is what their organization shows people)
 * and the setup flow when none is configured or `?flow=admin` says so. An
 * agent link is a member link.
 */
export function onboardingFlow({
  isAdmin,
  flowParam,
  agentId,
  formReady,
}: {
  isAdmin: boolean;
  flowParam?: string | null;
  agentId?: string | null;
  /** The organization's form is switched on and has a question or an agent. */
  formReady: boolean;
}): OnboardingFlow {
  if (!isAdmin) return "user";
  if (flowParam === "admin" || flowParam === "user") return flowParam;
  if (agentId) return "user";
  return formReady ? "user" : "admin";
}

/**
 * Who is sent to /onboarding on first run: an admin until the setup flow is
 * completed, a member while the organization's form waits for their answers.
 */
export function firstRunTarget({
  isAdmin,
  completed,
  formReady,
  submitted,
}: {
  isAdmin: boolean;
  /** `onboarding.completed` in the admin's own platform metadata for the organization. */
  completed: boolean;
  formReady: boolean;
  /** The member's answers are already in the organization's metadata. */
  submitted: boolean;
}): OnboardingFlow | null {
  if (isAdmin) return completed ? null : "admin";
  return formReady && !submitted ? "user" : null;
}
```

## `__tests__/house-journeys.test.ts`

```text
import { describe, expect, it } from "vitest";
import {
  createOrganizationUrl,
  decideEntry,
  firstRunTarget,
  isTrialUser,
  loginReturnUrl,
  onboardingFlow,
  ownOrg,
} from "../lib/iblai/house-journeys";

const main = "main";
const mainOnly = [{ key: "main", is_admin: false }];
const withOwn = [{ key: "main" }, { key: "acme", is_admin: true }];

describe("ownOrg", () => {
  it("keeps a stored organization the user belongs to", () => {
    expect(ownOrg("acme", withOwn, main)).toBe("acme");
  });
  it("skips a stored community organization and a stored stranger", () => {
    expect(ownOrg("main", withOwn, main)).toBe("acme");
    expect(ownOrg("gone", withOwn, main)).toBe("acme");
  });
  it("lands a user with nothing else on the community organization", () => {
    expect(ownOrg("", mainOnly, main)).toBe("main");
  });
});

describe("decideEntry", () => {
  it("enters a route organization of theirs", () => {
    expect(decideEntry({ routeOrg: "acme", stored: "", tenants: withOwn, main })).toEqual({ kind: "enter", org: "acme" });
  });
  it("previews a route organization they do not belong to, on their own underneath", () => {
    expect(decideEntry({ routeOrg: "other", stored: "acme", tenants: withOwn, main })).toEqual({
      kind: "preview",
      org: "acme",
      preview: "other",
    });
  });
  it("a user whose only organization is the community one previews on it", () => {
    expect(decideEntry({ routeOrg: "other", stored: "", tenants: mainOnly, main })).toEqual({
      kind: "preview",
      org: "main",
      preview: "other",
    });
  });
  it("with no route, their own organization; the community one when it is all they have", () => {
    expect(decideEntry({ routeOrg: "", stored: "main", tenants: withOwn, main })).toEqual({ kind: "enter", org: "acme" });
    expect(decideEntry({ routeOrg: "", stored: "", tenants: mainOnly, main })).toEqual({ kind: "main", org: "main" });
  });
  it("the community organization by route is `main`, never a preview", () => {
    expect(decideEntry({ routeOrg: "main", stored: "", tenants: withOwn, main })).toEqual({ kind: "main", org: "main" });
  });
  it("trusts the route while no organizations are stored", () => {
    expect(decideEntry({ routeOrg: "acme", stored: "", tenants: [], main })).toEqual({ kind: "enter", org: "acme" });
  });
});

describe("isTrialUser", () => {
  it("is the OS rule: on the community organization, not its admin, nowhere else", () => {
    expect(isTrialUser("main", mainOnly, main)).toBe(true);
    expect(isTrialUser("main", withOwn, main)).toBe(false);
    expect(isTrialUser("acme", withOwn, main)).toBe(false);
    expect(isTrialUser("main", [{ key: "main", is_admin: true }], main)).toBe(false);
  });
});

describe("the checkout links", () => {
  it("nest this app inside the login page", () => {
    const url = new URL(loginReturnUrl("http://localhost:3000", "crm"));
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("app")).toBe("crm");
    expect(url.searchParams.get("redirect-to")).toBe("http://localhost:3000");
  });
  it("send a new organization's admin through the $0 checkout and back", () => {
    const url = new URL(createOrganizationUrl("http://localhost:3000", "someone@example.com"));
    expect(url.pathname.endsWith("/api/service/stripe/checkout/redirect/credits-free-plan/")).toBe(true);
    const back = url.searchParams.get("redirect_url") ?? "";
    expect(back.startsWith(`${new URL(loginReturnUrl("x")).origin}/login?app=mentor&redirect-to=`)).toBe(true);
    expect(new URL(back).searchParams.get("redirect-to")).toBe("http://localhost:3000");
    expect(url.searchParams.get("cancel_url")).toBe(back);
    expect(url.searchParams.get("email")).toBe("someone@example.com");
  });
});

describe("onboardingFlow", () => {
  it("members always get the member flow", () => {
    expect(onboardingFlow({ isAdmin: false, flowParam: "admin", formReady: false })).toBe("user");
  });
  it("admins get the member flow when one is configured, the setup flow otherwise, `?flow=` winning", () => {
    expect(onboardingFlow({ isAdmin: true, formReady: true })).toBe("user");
    expect(onboardingFlow({ isAdmin: true, formReady: false })).toBe("admin");
    expect(onboardingFlow({ isAdmin: true, formReady: true, flowParam: "admin" })).toBe("admin");
    expect(onboardingFlow({ isAdmin: true, formReady: false, agentId: "abc" })).toBe("user");
  });
});

describe("firstRunTarget", () => {
  it("sends an admin until the setup flow is completed", () => {
    expect(firstRunTarget({ isAdmin: true, completed: false, formReady: false, submitted: false })).toBe("admin");
    expect(firstRunTarget({ isAdmin: true, completed: true, formReady: true, submitted: false })).toBeNull();
  });
  it("sends a member while the organization's form waits for their answers", () => {
    expect(firstRunTarget({ isAdmin: false, completed: false, formReady: true, submitted: false })).toBe("user");
    expect(firstRunTarget({ isAdmin: false, completed: false, formReady: true, submitted: true })).toBeNull();
    expect(firstRunTarget({ isAdmin: false, completed: false, formReady: false, submitted: false })).toBeNull();
  });
});
```

## `components/house/organization-preview.tsx`

```text
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import {
  OnboardingShell,
  StepHeader,
  onboardingPrimaryButtonClass,
  onboardingSecondaryButtonClass,
} from "@iblai/iblai-js/web-containers";
import { redirectToAuthSpaJoinTenant, useTenantMetadata } from "@iblai/iblai-js/web-utils";
import config from "@/lib/iblai/config";
import { createOrganizationUrl, readUserEmail } from "@/lib/iblai/house-journeys";

/** The outlined twin of the SDK's primary onboarding button. */
const outlined =
  "inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50";

/**
 * A signed-in visitor on an organization they do not belong to: its name and
 * logo from the public metadata, Join (the auth page joins them, or says why
 * not), or an organization of their own through ibl.ai's $0 sign-up. The app
 * runs on their own organization underneath. The key stands in for the name
 * until the metadata answers — an unknown key never answers (the data layer
 * retries a 404), and the screen must not wait for it.
 */
export function OrganizationPreview({ org, app = "mentor" }: { org: string; app?: string }) {
  const t = useTranslations("houseJourneys.preview");
  const { platformName } = useTenantMetadata({ org });
  const [logo, setLogo] = useState(true);
  const name = platformName || org;
  return (
    <OnboardingShell totalSteps={1} currentStep={1}>
      <div data-testid="organization-preview" className="space-y-6">
        {logo && (
          <Image
            src={`${config.dmUrl()}/api/core/orgs/${encodeURIComponent(org)}/logo/`}
            alt=""
            width={160}
            height={48}
            unoptimized
            onError={() => setLogo(false)}
            className="mx-auto h-12 w-auto object-contain"
          />
        )}
        <StepHeader icon={Building2} title={name} subtitle={t("body", { name })} />
        <div className="space-y-3">
          <button
            type="button"
            className={onboardingPrimaryButtonClass}
            onClick={() => redirectToAuthSpaJoinTenant(config.authUrl(), org, window.location.href)}
          >
            {t("join", { name })}
          </button>
          <button
            type="button"
            className={outlined}
            onClick={() =>
              window.location.assign(createOrganizationUrl(window.location.origin, readUserEmail(), app))
            }
          >
            {t("create")}
          </button>
          <Link href="/" className={onboardingSecondaryButtonClass}>
            {t("back")}
          </Link>
        </div>
      </div>
    </OnboardingShell>
  );
}
```

## `components/house/upgrade-modal.tsx`

```text
"use client";

import { useDispatch, useSelector } from "react-redux";
import { UpgradePackageModal } from "@iblai/iblai-js/web-containers";
import { setOpenPricingModal } from "@iblai/iblai-js/web-utils";
import { loginReturnUrl, mainOrg, readUserEmail } from "@/lib/iblai/house-journeys";

type State = { subscription?: { openPricingModal?: boolean } };

/**
 * The SDK's "Upgrade for free" dialog — the $0 checkout that gives a user on
 * the community organization one of their own. Opened by any trial-gated
 * click (`setOpenPricingModal(true)`) and by a 402 that carries a pricing
 * table; the platform returns them into this app on the new organization.
 * Mount once in the platform layout.
 */
export function UpgradeModal({ org, app = "mentor" }: { org: string; app?: string }) {
  const dispatch = useDispatch();
  const open = useSelector((state: State) => !!state.subscription?.openPricingModal);
  if (!open) return null;
  return (
    <UpgradePackageModal
      open
      onClose={() => dispatch(setOpenPricingModal(false))}
      redirectUrl={loginReturnUrl(window.location.origin, app)}
      sourcePlatformKey={org}
      mainPlatformKey={mainOrg()}
      currentUserEmail={readUserEmail()}
    />
  );
}
```

## `components/house/credit-badge.tsx`

```text
"use client";

import { CreditBalance, isPlatformNavbarCreditBalanceVisible } from "@iblai/iblai-js/web-containers";
import { isTrialUser, mainOrg, readTenants, readUserEmail, readUsername } from "@/lib/iblai/house-journeys";

/**
 * The OS's credit badge under the SDK's own visibility rule: a live admin of
 * an organization with the paywall (plan, Upgrade, Add Credits, Manage
 * Billing), or a trial user on the community organization ("Free",
 * Upgrade Plan). The SDK handles every checkout. Place it in the top bar.
 */
export function CreditBadge({
  org,
  isLiveAdmin,
  className,
}: {
  org: string;
  /** Admin AND in Admin mode. */
  isLiveAdmin: boolean;
  className?: string;
}) {
  const tenants = readTenants();
  const main = mainOrg();
  const username = readUsername();
  const email = readUserEmail();
  const visible = isPlatformNavbarCreditBalanceVisible({
    tenantKey: org,
    currentTenant: { key: org, show_paywall: tenants.find((t) => t.key === org)?.show_paywall ?? null },
    // The hosted platform's ecommerce switch is on.
    stripeEnabled: true,
    isLiveAdmin,
    userOnFreeTrial: isTrialUser(org, tenants, main),
    mainPlatformKey: main,
    currentUserEmail: email,
    username,
  });
  if (!visible) return null;
  return (
    <CreditBalance
      tenant={org}
      username={username}
      mainPlatformKey={main}
      currentUserEmail={email}
      redirectUrl={typeof window === "undefined" ? "" : window.location.origin}
      enabled
      className={className}
    />
  );
}
```

## `components/house/first-run-gate.tsx`

```text
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGetUserPlatformMetadataQuery } from "@iblai/iblai-js/data-layer";
import {
  hasOnboardingContent,
  readUserOnboardingForm,
  readUserOnboardingSubmission,
} from "@iblai/iblai-js/web-containers";
import { useTenantMetadata } from "@iblai/iblai-js/web-utils";
import { LoadingScreen } from "@/components/loading-screen";
import { firstRunTarget, mainOrg, readUsername } from "@/lib/iblai/house-journeys";

/** The organization an admin was sent to setup for, this session. */
const SENT = "house_setup_sent";

/**
 * First run. An admin who has not finished the SDK setup flow is sent to
 * `/platform/<org>/onboarding?flow=admin` once per session; a member is sent
 * to `/platform/<org>/onboarding` while the organization's form waits for
 * their answers. Wraps the platform page tree; the onboarding route and the
 * community organization pass through, and so does a failed read.
 */
export function FirstRunGate({
  org,
  isAdmin,
  children,
}: {
  org: string;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const base = `/platform/${encodeURIComponent(org)}/onboarding`;
  const [username] = useState(readUsername);
  const [sent] = useState(() => typeof window !== "undefined" && sessionStorage.getItem(SENT) === org);
  const skip = pathname.startsWith(base) || org === mainOrg() || (isAdmin && sent);
  const user = useGetUserPlatformMetadataQuery({ tenantKey: org }, { skip: skip || !isAdmin });
  const organization = useTenantMetadata({ org, skip: skip || isAdmin });
  const loading = isAdmin ? user.isLoading : organization.isLoading;

  let target: "admin" | "user" | null = null;
  if (!skip && !loading) {
    if (isAdmin) {
      const onboarding = (user.data?.metadata as { onboarding?: { completed?: boolean } } | null)?.onboarding;
      target = user.isError
        ? null
        : firstRunTarget({ isAdmin, completed: onboarding?.completed === true, formReady: false, submitted: false });
    } else {
      const form = readUserOnboardingForm(organization.metadata);
      target = organization.isError
        ? null
        : firstRunTarget({
            isAdmin,
            completed: true,
            formReady: form.enabled && hasOnboardingContent(form),
            submitted: !!readUserOnboardingSubmission(organization.metadata, username),
          });
    }
  }

  useEffect(() => {
    if (!target) return;
    if (target === "admin") sessionStorage.setItem(SENT, org);
    router.replace(target === "admin" ? `${base}?flow=admin` : base);
  }, [target, org, base, router]);

  if ((!skip && loading) || target) return <LoadingScreen className="min-h-0 flex-1" />;
  return <>{children}</>;
}
```

## `components/house/onboarding-page.tsx`

```text
"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bot, PartyPopper } from "lucide-react";
import {
  OnboardingWizard,
  StepHeader,
  hasOnboardingContent,
  onboardingPrimaryButtonClass,
  onboardingSecondaryButtonClass,
  readUserOnboardingForm,
  type OnboardingFinalStepContext,
} from "@iblai/iblai-js/web-containers";
import { useTenantMetadata } from "@iblai/iblai-js/web-utils";
import { LoadingScreen } from "@/components/loading-screen";
import config from "@/lib/iblai/config";
import { onboardingFlow, readTenants, readUsername } from "@/lib/iblai/house-journeys";

/**
 * `/platform/[tenantKey]/onboarding/[[...agentId]]` — the SDK onboarding
 * wizard, inside the shell the way the LMS mounts it. Members get the
 * organization's own form (authored in Management › Onboarding) and its agent
 * on the last step; an admin's first run is the setup flow (organization →
 * sector → invite your team), and `?flow=` switches. The route file is one
 * line: `export { OnboardingPage as default } from "@/components/house/onboarding-page";`
 */
export function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingScreen className="min-h-0 flex-1" />}>
      <Onboarding />
    </Suspense>
  );
}

function Onboarding() {
  const router = useRouter();
  const params = useParams<{ tenantKey: string; agentId?: string[] }>();
  const org = decodeURIComponent(params.tenantKey ?? "");
  const agentId = params.agentId?.[0];
  const flowParam = useSearchParams().get("flow");
  const [username] = useState(readUsername);
  const [isAdmin] = useState(() => !!readTenants().find((t) => t.key === org)?.is_admin);
  const { metadata, isLoading } = useTenantMetadata({ org });
  if (isLoading) return <LoadingScreen className="min-h-0 flex-1" />;

  const form = readUserOnboardingForm(metadata);
  const flow = onboardingFlow({
    isAdmin,
    flowParam,
    agentId,
    formReady: form.enabled && hasOnboardingContent(form),
  });
  const userFlow = flow === "user";
  const home = `/platform/${encodeURIComponent(org)}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="onboarding-page">
      <OnboardingWizard
        // A switch of flow or agent link starts a fresh run.
        key={`${flow}:${agentId ?? ""}`}
        tenant={org}
        username={username}
        brandName={config.appName() || undefined}
        isAdminOnboarding={!userFlow}
        agentId={agentId}
        renderFinalStep={
          userFlow ? (context) => <MeetAgentStep {...context} /> : (context) => <AllSetStep {...context} />
        }
        // An admin following a member link is looking, not answering.
        onResponsesSubmit={isAdmin && userFlow ? async () => {} : undefined}
        // A one-way door: replace, so Back does not re-enter it.
        onComplete={() => router.replace(home)}
      />
    </div>
  );
}

/** The member flow's last step: the agent the organization hands over, then the app. */
function MeetAgentStep({ agent, goBack, complete }: OnboardingFinalStepContext) {
  const t = useTranslations("houseJourneys.onboarding");
  return (
    <div data-testid="onboarding-final-step">
      <StepHeader
        icon={agent ? Bot : PartyPopper}
        title={agent ? agent.title || t("meetTitle", { name: agent.name ?? "" }) : t("allSetTitle")}
        subtitle={agent ? agent.description || t("meetBody") : t("allSetMember")}
      />
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => complete(agent?.mentor_unique_id ?? null)}
          className={onboardingPrimaryButtonClass}
        >
          {t("continue")}
        </button>
        <button type="button" onClick={goBack} className={onboardingSecondaryButtonClass}>
          {t("back")}
        </button>
      </div>
    </div>
  );
}

/** The setup flow's last step: the SDK ships none, so the host owns it. */
function AllSetStep({ answers, goBack, complete }: OnboardingFinalStepContext) {
  const t = useTranslations("houseJourneys.onboarding");
  return (
    <div data-testid="onboarding-final-step">
      <StepHeader
        icon={PartyPopper}
        title={t("allSetTitle")}
        subtitle={t("allSetBody", { workspace: answers.organizationName || t("workspace") })}
      />
      <div className="space-y-3">
        <button type="button" onClick={() => complete()} className={onboardingPrimaryButtonClass}>
          {t("complete")}
        </button>
        <button type="button" onClick={goBack} className={onboardingSecondaryButtonClass}>
          {t("back")}
        </button>
      </div>
    </div>
  );
}
```

## `e2e/journeys/house.journey.spec.ts`

```text
import { test, expect, type Page } from "@playwright/test";

/**
 * House journeys — the first-run paths of an ibl.ai official app
 * (/iblai-vibe-house-journeys): a user whose only organization is the
 * community one (H1–H2), a visitor on an organization they do not belong to
 * (H3–H4), an admin's first run (H5–H6) and a member's (H7–H8).
 * Organization-wide state is served with page.route and never written; the
 * accounts' own metadata writes are answered by the route, so they stay fresh.
 * Signed in through auth.setup.ts; the member tests skip until
 * `pnpm e2e:accounts` has created the member account.
 */
const appHost = process.env.APP_HOST || "http://localhost:3000";
const MAIN = process.env.NEXT_PUBLIC_MAIN_TENANT_KEY || "main";
const stamp = Date.now().toString(36);
const noMember = !process.env.PLAYWRIGHT_MEMBER_USERNAME || !process.env.PLAYWRIGHT_MEMBER_PASSWORD;
const NO_MEMBER = "no member account in e2e/.env.development (PLAYWRIGHT_MEMBER_*): pnpm e2e:accounts creates one";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const home = (org: string) => new RegExp(`/platform/${esc(org)}/?(\\?|#|$)`);
const onboarding = (org: string) => new RegExp(`/platform/${esc(org)}/onboarding(/|\\?|#|$)`);

/** The organization the session lands on: the segment after /platform/. */
async function landedOrg(page: Page): Promise<string> {
  await page.goto(`${appHost}/`);
  await page.waitForURL(/\/platform\/[^/?#]+/, { timeout: 30_000 });
  return decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);
}

const memberState = async ({ browserName }: { browserName: string }, use: (state: string) => Promise<void>) => {
  await use(`playwright/.auth/member-${browserName}.json`);
};

test.describe("a user whose only organization is the community one", () => {
  test.skip(noMember, NO_MEMBER);
  test.use({ storageState: memberState });
  // The member account's session, told it belongs to the community organization
  // only — in storage and by the platform's membership list, which the SDK
  // re-reads on every load.
  test.beforeEach(async ({ page }) => {
    const entry = { key: MAIN, org: MAIN, platform_name: "ibl.ai", is_admin: false, show_paywall: true };
    await page.route(/\/api\/ibl\/users\/manage\/platform\//, (route) => route.fulfill({ json: [entry] }));
    await page.addInitScript((only: typeof entry) => {
      localStorage.setItem("tenants", JSON.stringify([only]));
      localStorage.setItem("tenant", only.key);
      localStorage.setItem("current_tenant", JSON.stringify(only));
      localStorage.setItem("app_tenant", only.key);
    }, entry);
  });

  test("H1 · lands on the community organization inside the shell, with the admin cluster shown", async ({ page }) => {
    await page.goto(`${appHost}/`);
    await expect(page).toHaveURL(home(MAIN), { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Management" })).toBeVisible({ timeout: 30_000 });
  });

  test("H2 · a trial-gated click opens the SDK upgrade dialog, and Escape closes it", async ({ page }) => {
    await page.goto(`${appHost}/platform/${encodeURIComponent(MAIN)}`);
    await page.getByRole("button", { name: "Management" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Upgrade for free", { timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("a visitor on an organization they do not belong to", () => {
  test.skip(noMember, NO_MEMBER);
  test.use({ storageState: memberState });
  const stranger = `e2e-nowhere-${stamp}`;

  test("H3 · the organization is previewed, and Join goes to the auth page's join for it", async ({ page }) => {
    let joinUrl = "";
    await page.route(/\/join\?tenant=/, (route) => {
      joinUrl = route.request().url();
      return route.fulfill({ status: 204, body: "" });
    });
    await page.goto(`${appHost}/platform/${stranger}`);
    const preview = page.getByTestId("organization-preview");
    await expect(preview).toBeVisible({ timeout: 30_000 });
    await expect(preview).toContainText(stranger);
    await preview.getByRole("button", { name: `Join ${stranger}` }).click();
    await expect.poll(() => joinUrl).toContain(`tenant=${stranger}`);
    expect(new URL(joinUrl).searchParams.get("redirect-to")).toContain(`/platform/${stranger}`);
  });

  test("H4 · Create your own organization is ibl.ai's $0 sign-up with this app nested in the return address", async ({
    page,
  }) => {
    let checkout = "";
    await page.route(/credits-free-plan/, (route) => {
      checkout = route.request().url();
      return route.fulfill({ status: 204, body: "" });
    });
    await page.goto(`${appHost}/platform/${stranger}`);
    await page
      .getByTestId("organization-preview")
      .getByRole("button", { name: "Create your own organization" })
      .click();
    await expect.poll(() => checkout).toContain("/api/service/stripe/checkout/redirect/credits-free-plan/");
    const back = new URL(checkout).searchParams.get("redirect_url") ?? "";
    expect(new URL(back).searchParams.get("redirect-to")).toBe(appHost);
  });
});

test.describe("an admin's first run", () => {
  test("H5 · an admin who has not finished the setup flow is sent to it once: organization, sector, team, done", async ({
    page,
  }) => {
    await page.addInitScript(() => sessionStorage.removeItem("house_setup_sent"));
    await page.route(/\/api\/core\/users\/platform-metadata\//, (route) => {
      const done = { username: "", platform_key: "", metadata: { onboarding: { completed: true } } };
      if (route.request().method() === "GET") {
        return route.fulfill({ json: { username: "", platform_key: "", metadata: {} } });
      }
      return route.fulfill({ json: done });
    });
    const org = await landedOrg(page);
    await expect(page).toHaveURL(onboarding(org), { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /^Welcome to/ })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Organization name").fill("E2E School");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: "Higher Education" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Invite your team")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("onboarding-final-step")).toContainText("all set", { timeout: 15_000 });
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page).toHaveURL(home(org), { timeout: 30_000 });
  });

  test("H6 · an admin who finished it stays home", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem("house_setup_sent"));
    await page.route(/\/api\/core\/users\/platform-metadata\//, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: { username: "", platform_key: "", metadata: { onboarding: { completed: true } } } })
        : route.continue(),
    );
    const org = await landedOrg(page);
    await expect(page).toHaveURL(home(org), { timeout: 30_000 });
    await expect(page.locator("main")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("onboarding-page")).toHaveCount(0);
  });
});

test.describe("a member's first run", () => {
  test.skip(noMember, NO_MEMBER);
  test.use({ storageState: memberState });

  test("H7 · a member is sent to the organization's form, answers it, sees the final step and lands home", async ({
    page,
  }) => {
    const form = {
      version: 1,
      enabled: true,
      title: "Welcome",
      sections: [
        { key: "about", title: "About you", fields: [{ key: "role", type: "text", label: "Your role", required: true }] },
      ],
      agents: [],
    };
    // The organization's metadata, with the form added on every read and the
    // member's answers kept once written — nothing reaches the platform.
    let written: Record<string, unknown> = {};
    await page.route(/\/api\/core\/orgs\/[^/]+\/metadata\//, async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        const res = await route.fetch();
        const body = (await res.json()) as { metadata?: Record<string, unknown> };
        return route.fulfill({
          response: res,
          json: { ...body, metadata: { ...body.metadata, ...written, user_onboarding_form: form } },
        });
      }
      const sent = req.postDataJSON() as { metadata?: Record<string, unknown> } | null;
      written = sent?.metadata ?? sent ?? {};
      return route.fulfill({ json: { metadata: written } });
    });
    const org = await landedOrg(page);
    await expect(page).toHaveURL(onboarding(org), { timeout: 30_000 });
    await page.getByLabel("Your role").fill("Student");
    await page.getByRole("button", { name: /^(Submit|Continue)$/ }).click();
    await expect(page.getByTestId("onboarding-final-step")).toContainText("all set", { timeout: 15_000 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(home(org), { timeout: 30_000 });
  });

  test("H8 · with nothing configured, /onboarding says so and Continue goes home", async ({ page }) => {
    const org = await landedOrg(page);
    await page.goto(`${appHost}/platform/${encodeURIComponent(org)}/onboarding`);
    const empty = page.getByTestId("user-onboarding-empty");
    await expect(empty).toBeVisible({ timeout: 30_000 });
    await empty.getByRole("button").click();
    await expect(page).toHaveURL(home(org), { timeout: 30_000 });
  });
});
```

## `messages/house-journeys.en.json`

```text
{
  "houseJourneys": {
    "preview": {
      "body": "You’re not a member of {name} yet. Join it, or create an organization of your own.",
      "join": "Join {name}",
      "create": "Create your own organization",
      "back": "Back to my organization"
    },
    "onboarding": {
      "meetTitle": "Meet {name}",
      "meetBody": "Your organization’s agent is ready whenever you are.",
      "allSetTitle": "You’re all set",
      "allSetBody": "{workspace} is ready. Head in.",
      "allSetMember": "Thanks — your organization has what it needs. Head in.",
      "workspace": "Your organization",
      "continue": "Continue",
      "complete": "Complete",
      "back": "Back"
    }
  }
}
```

## `messages/house-journeys.es.json`

```text
{
  "houseJourneys": {
    "preview": {
      "body": "Todavía no eres miembro de {name}. Únete, o crea una organización propia.",
      "join": "Unirse a {name}",
      "create": "Crear tu propia organización",
      "back": "Volver a mi organización"
    },
    "onboarding": {
      "meetTitle": "Conoce a {name}",
      "meetBody": "El agente de tu organización está listo cuando tú lo estés.",
      "allSetTitle": "Todo listo",
      "allSetBody": "{workspace} está lista. Adelante.",
      "allSetMember": "Gracias: tu organización ya tiene lo que necesita. Adelante.",
      "workspace": "Tu organización",
      "continue": "Continuar",
      "complete": "Completar",
      "back": "Atrás"
    }
  }
}
```

## `messages/house-journeys.fr.json`

```text
{
  "houseJourneys": {
    "preview": {
      "body": "Vous n’êtes pas encore membre de {name}. Rejoignez-la, ou créez votre propre organisation.",
      "join": "Rejoindre {name}",
      "create": "Créer votre propre organisation",
      "back": "Retour à mon organisation"
    },
    "onboarding": {
      "meetTitle": "Rencontrez {name}",
      "meetBody": "L’agent de votre organisation est prêt quand vous l’êtes.",
      "allSetTitle": "Tout est prêt",
      "allSetBody": "{workspace} est prête. Entrez.",
      "allSetMember": "Merci : votre organisation a ce qu’il lui faut. Entrez.",
      "workspace": "Votre organisation",
      "continue": "Continuer",
      "complete": "Terminer",
      "back": "Retour"
    }
  }
}
```

## `messages/house-journeys.zh.json`

```text
{
  "houseJourneys": {
    "preview": {
      "body": "你还不是 {name} 的成员。加入它，或创建你自己的组织。",
      "join": "加入 {name}",
      "create": "创建你自己的组织",
      "back": "返回我的组织"
    },
    "onboarding": {
      "meetTitle": "认识 {name}",
      "meetBody": "你的组织的智能体随时为你服务。",
      "allSetTitle": "一切就绪",
      "allSetBody": "{workspace} 已准备好。进入吧。",
      "allSetMember": "谢谢，你的组织已获得所需信息。进入吧。",
      "workspace": "你的组织",
      "continue": "继续",
      "complete": "完成",
      "back": "返回"
    }
  }
}
```
