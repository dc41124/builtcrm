import * as samlify from "samlify";
import * as validator from "@authenio/samlify-node-xmllint";

// samlify requires a schema validator to be registered on startup. Using
// the WASM-based node-xmllint so we don't need native xmllint on the host.
// Registration is idempotent — safe to import this module from multiple
// callers.
samlify.setSchemaValidator(validator);

export type ProviderRow = {
  id: string;
  entityId: string;
  ssoUrl: string;
  certificatePem: string;
};

// Our Service Provider entity ID + ACS URL are derived from the app URL.
// The IdP is configured (on their side) with these values, so they must
// be stable and publicly resolvable. ACS is `/api/auth/sso/acs?providerId=X`
// — the providerId query param tells the handler which IdP cert to verify
// against.
export function ourSpEntityId(): string {
  const base = requiredAppUrl();
  return `${base}/api/auth/sso`;
}

export function ourAcsUrl(providerId: string): string {
  const base = requiredAppUrl();
  return `${base}/api/auth/sso/acs?providerId=${encodeURIComponent(providerId)}`;
}

function requiredAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set. SAML SP metadata requires it.",
    );
  }
  return url.replace(/\/$/, "");
}

// Build the samlify ServiceProvider representation of OUR side of the
// handshake. We don't sign AuthnRequests (the IdP doesn't require it for
// most SAML 2.0 SP-initiated flows we'd encounter), but we do require the
// IdP to sign the assertion + response so we can verify authenticity.
export function buildServiceProvider(providerId: string): samlify.ServiceProviderInstance {
  return samlify.ServiceProvider({
    entityID: ourSpEntityId(),
    assertionConsumerService: [
      {
        Binding: samlify.Constants.namespace.binding.post,
        Location: ourAcsUrl(providerId),
      },
    ],
    wantAssertionsSigned: true,
    wantMessageSigned: false,
    authnRequestsSigned: false,
  });
}

// Build the samlify IdentityProvider from a DB row. Only metadata we need
// for the two handshakes we care about: AuthnRequest destination (ssoUrl)
// and assertion signature verification (certificatePem).
export function buildIdentityProvider(
  provider: ProviderRow,
): samlify.IdentityProviderInstance {
  return samlify.IdentityProvider({
    entityID: provider.entityId,
    singleSignOnService: [
      {
        Binding: samlify.Constants.namespace.binding.redirect,
        Location: provider.ssoUrl,
      },
    ],
    signingCert: provider.certificatePem,
    isAssertionEncrypted: false,
    messageSigningOrder: "encrypt-then-sign",
  });
}
