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
