let auth0Client = null;
let authConfig = null;
let cachedUser = null;

const getCreateAuth0Client = () => {
  if (typeof window.createAuth0Client === "function") return window.createAuth0Client;
  if (window.auth0 && typeof window.auth0.createAuth0Client === "function") {
    return window.auth0.createAuth0Client;
  }
  return null;
};

const loadAuth0Sdk = () =>
  new Promise((resolve, reject) => {
    if (getCreateAuth0Client()) return resolve(true);
    const existing = document.querySelector('script[data-auth0-sdk="true"]');
    if (existing) {
      const start = Date.now();
      const timer = setInterval(() => {
        if (getCreateAuth0Client()) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - start > 5000) {
          clearInterval(timer);
          reject(new Error("Auth0 SDK failed to load"));
        }
      }, 150);
      existing.addEventListener("error", () => reject(new Error("Auth0 SDK failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js";
    script.async = true;
    script.dataset.auth0Sdk = "true";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Auth0 SDK failed to load"));
    document.head.appendChild(script);
  });

const hasAuthParams = () => {
  const params = new URLSearchParams(window.location.search);
  return params.has("code") && params.has("state");
};

export const initAuth = async () => {
  const res = await fetch("/auth/config");
  const cfg = await res.json();
  if (!cfg?.domain || !cfg?.clientId) throw new Error("Auth0 config missing");
  authConfig = cfg;

  if (!getCreateAuth0Client()) {
    await loadAuth0Sdk();
  }

  const factory = getCreateAuth0Client();
  if (!factory) throw new Error("Auth0 SDK not loaded");

  auth0Client = await factory({
    domain: authConfig.domain,
    clientId: authConfig.clientId,
    cacheLocation: "localstorage",
    useRefreshTokens: true,
    authorizationParams: {
      audience: authConfig.audience,
      redirect_uri: `${window.location.origin}/auth/callback`,
    },
  });

  if (hasAuthParams()) {
    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, "/");
  }

  const isAuthed = await auth0Client.isAuthenticated();
  cachedUser = isAuthed ? await auth0Client.getUser() : null;
  return { isAuthed, user: cachedUser };
};

export const login = async () => {
  if (!auth0Client) await initAuth();
  if (!auth0Client) throw new Error("Auth0 client not initialized");
  await auth0Client.loginWithRedirect({
    authorizationParams: {
      audience: authConfig?.audience,
      redirect_uri: `${window.location.origin}/auth/callback`,
    },
  });
};

export const logout = async () => {
  if (!auth0Client) return;
  await auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
};

export const getUser = async () => {
  if (!auth0Client) return null;
  cachedUser = await auth0Client.getUser();
  return cachedUser;
};

export const isAuthenticated = async () => {
  if (!auth0Client) return false;
  return auth0Client.isAuthenticated();
};

export const getAccessToken = async () => {
  if (!auth0Client) return null;
  try {
    return await auth0Client.getTokenSilently({
      authorizationParams: { audience: authConfig?.audience },
    });
  } catch {
    return null;
  }
};

export const getAuthConfig = () => authConfig;
