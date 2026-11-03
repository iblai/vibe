// Hide console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(any(target_os = "ios", target_os = "android"))]
use std::sync::Mutex;
use tauri::utils::config::FrontendDist;
#[cfg(any(target_os = "ios", target_os = "android"))]
use tauri::Listener;
use tauri::{Manager, Url, WebviewWindow, WebviewWindowBuilder};
#[cfg(any(target_os = "ios", target_os = "android"))]
use tauri_plugin_deep_link::DeepLinkExt;
// OpenerExt is used for all non-iOS platforms (desktop and Android)
#[cfg(not(target_os = "ios"))]
use tauri_plugin_opener::OpenerExt;
#[cfg(any(target_os = "ios", target_os = "macos"))]
use {
    block::ConcreteBlock,
    objc::declare::ClassDecl,
    objc::runtime::{Class, Object, BOOL, YES},
    objc::{class, msg_send, sel, sel_impl},
    std::ffi::{CStr, CString},
    std::ptr,
    std::sync::Once,
};

// The URL scheme the sign-in returns on; must match tauri.conf.json and NEXT_PUBLIC_TAURI_CUSTOM_SCHEME.
const AUTH_SCHEME: &str = "my-app";
// The auth app's own scheme: a sign-in completed inside the webview returns on it.
const AUTH_APP_SCHEME: &str = "iblai-mentor";

// Global storage for pending deep links (mobile only)
#[cfg(any(target_os = "ios", target_os = "android"))]
static PENDING_DEEP_LINK: std::sync::OnceLock<Mutex<Option<Url>>> = std::sync::OnceLock::new();

#[cfg(any(target_os = "ios", target_os = "android"))]
fn get_pending_deep_link() -> &'static Mutex<Option<Url>> {
    PENDING_DEEP_LINK.get_or_init(|| Mutex::new(None))
}

// OAuth provider URL patterns — intercepted and opened externally
const OAUTH_URL_PATTERNS: &[&str] = &[
    "accounts.google.com",
    "google.com/o/oauth",
    "googleapis.com/oauth",
    "google-oauth2",
    "/auth/login/google",
    "/login/google",
    "appleid.apple.com",
    "/auth/login/apple",
    "/login/apple",
];

fn is_oauth_url(url: &str) -> bool {
    OAUTH_URL_PATTERNS
        .iter()
        .any(|pattern| url.contains(pattern))
}

// ---------------------------------------------------------------------------
// Desktop navigation guard: the window stays on the app and the platform
// ---------------------------------------------------------------------------

/// Hosts the desktop window may load besides the configured app URL: the
/// platform, the webview's own origins, and embeds (on macOS and Linux an
/// iframe's host is checked too). Self-hosted platforms add their domain.
#[cfg(not(any(target_os = "ios", target_os = "android")))]
const ALLOWED_HOST_SUFFIXES: &[&str] = &[
    "iblai.app",
    "iblai.org",
    "stripe.com",
    "localhost",
    "127.0.0.1",
];

/// The URL the window loads: `devUrl` under `tauri dev`, else a URL `frontendDist`.
fn configured_app_url(config: &tauri::Config) -> Option<Url> {
    if tauri::is_dev() {
        config.build.dev_url.clone()
    } else if let Some(FrontendDist::Url(url)) = &config.build.frontend_dist {
        Some(url.clone())
    } else {
        None
    }
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn configured_app_host(config: &tauri::Config) -> Option<String> {
    configured_app_url(config)
        .as_ref()
        .and_then(|u| u.host_str())
        .map(str::to_ascii_lowercase)
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn allowed_nav(url: &tauri::Url, app_host: Option<&str>) -> bool {
    if matches!(url.scheme(), "tauri" | "asset") {
        return true;
    }
    // No host (about:, data:, blob:) is never a match.
    let Some(host) = url.host_str() else {
        return false;
    };
    let host = host.to_ascii_lowercase();
    app_host.is_some_and(|app| app.eq_ignore_ascii_case(&host))
        || ALLOWED_HOST_SUFFIXES
            .iter()
            .any(|s| host == *s || host.ends_with(&format!(".{s}")))
}

// ---------------------------------------------------------------------------
// Sign-in return: the auth app sends the webview back on a custom scheme
// ---------------------------------------------------------------------------

/// The app URL a sign-in return loads, if `url` is one: the auth app returns
/// on `AUTH_SCHEME` from the system browser and on `AUTH_APP_SCHEME` from
/// inside the webview, always to `/sso-login…`.
fn sign_in_return(url: &Url, app_url: &Url) -> Option<Url> {
    if url.scheme() != AUTH_SCHEME && url.scheme() != AUTH_APP_SCHEME {
        return None;
    }
    // `scheme://sso-login-complete?…` parses its first segment as the host.
    let path = match (url.path(), url.host_str()) {
        ("" | "/", Some(host)) if !host.is_empty() => format!("/{host}"),
        (path, _) => path.to_string(),
    };
    if !path.starts_with("/sso-login") && !path.starts_with("/mobile-sso-login") {
        return None;
    }
    let mut target = app_url.clone();
    target.set_path(&path);
    target.set_query(url.query());
    Some(target)
}

/// Load `url` in `window` from another thread: calling into a webview from
/// inside its own navigation handler is not safe on every engine.
fn go_to(window: WebviewWindow, url: Url) {
    std::thread::spawn(move || {
        if let Err(err) = window.navigate(url) {
            println!("[ibl.ai] navigation failed: {err}");
        }
    });
}

/// A sign-in return delivered outside the webview (a deep link, the auth
/// session's callback): load it, or keep it until the window exists.
#[cfg(any(target_os = "ios", target_os = "android", target_os = "macos"))]
fn handle_sign_in_url(app_handle: &tauri::AppHandle, raw_url: &str) {
    let Ok(url) = Url::parse(raw_url) else {
        return;
    };
    let Some(target) =
        configured_app_url(app_handle.config()).and_then(|app_url| sign_in_return(&url, &app_url))
    else {
        return;
    };
    if let Some(window) = app_handle.get_webview_window("main") {
        go_to(window, target);
        return;
    }
    #[cfg(any(target_os = "ios", target_os = "android"))]
    if let Ok(mut pending) = get_pending_deep_link().lock() {
        *pending = Some(target);
    }
}

// ---------------------------------------------------------------------------
// iOS: ASWebAuthenticationSession + SafariServices
// ---------------------------------------------------------------------------

#[cfg(any(target_os = "ios", target_os = "macos"))]
#[link(name = "AuthenticationServices", kind = "framework")]
extern "C" {}

#[cfg(target_os = "ios")]
#[link(name = "SafariServices", kind = "framework")]
extern "C" {}

#[cfg(target_os = "ios")]
#[allow(unexpected_cfgs)]
fn open_url_via_application(ns_url: *mut Object) -> Result<(), String> {
    unsafe {
        if ns_url.is_null() {
            return Err("NSURL was null".to_string());
        }
        let app: *mut Object = msg_send![class!(UIApplication), sharedApplication];
        if app.is_null() {
            return Err("Failed to access UIApplication".to_string());
        }
        let responds: BOOL =
            msg_send![app, respondsToSelector: sel!(openURL:options:completionHandler:)];
        if responds == YES {
            let _: () = msg_send![
                app,
                openURL: ns_url
                options: ptr::null::<Object>()
                completionHandler: ptr::null::<Object>()
            ];
        } else {
            let _: BOOL = msg_send![app, openURL: ns_url];
        }
    }
    Ok(())
}

#[cfg(target_os = "ios")]
#[allow(unexpected_cfgs)]
unsafe fn get_presentation_window() -> *mut Object {
    let app: *mut Object = msg_send![class!(UIApplication), sharedApplication];
    let windows: *mut Object = msg_send![app, windows];
    let window_count: usize = msg_send![windows, count];
    if window_count > 0 {
        msg_send![windows, objectAtIndex: 0usize]
    } else {
        ptr::null_mut()
    }
}

#[cfg(target_os = "ios")]
#[allow(unexpected_cfgs)]
unsafe fn get_context_provider_class() -> &'static Class {
    static REGISTER_CLASS: Once = Once::new();
    static mut CONTEXT_PROVIDER_CLASS: Option<&'static Class> = None;

    REGISTER_CLASS.call_once(|| {
        let superclass = class!(NSObject);
        let mut decl = ClassDecl::new("IBLAuthContextProvider", superclass).unwrap();

        extern "C" fn presentation_anchor_for_session(
            _: &Object,
            _: objc::runtime::Sel,
            _session: *mut Object,
        ) -> *mut Object {
            unsafe { get_presentation_window() }
        }

        unsafe {
            decl.add_method(
                sel!(presentationAnchorForWebAuthenticationSession:),
                presentation_anchor_for_session
                    as extern "C" fn(&Object, objc::runtime::Sel, *mut Object) -> *mut Object,
            );
        }

        let class = decl.register();
        CONTEXT_PROVIDER_CLASS = Some(class);
    });

    unsafe { CONTEXT_PROVIDER_CLASS.unwrap() }
}

#[cfg(target_os = "ios")]
#[allow(unexpected_cfgs)]
fn open_with_auth_session(url: &str, app_handle: &tauri::AppHandle) -> Result<(), String> {
    unsafe {
        let c_url =
            CString::new(url).map_err(|_| "Failed to create CString from URL".to_string())?;
        let ns_string: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: c_url.as_ptr()];
        if ns_string.is_null() {
            return Err("Failed to create NSString".to_string());
        }

        let ns_url: *mut Object = msg_send![class!(NSURL), URLWithString: ns_string];
        if ns_url.is_null() {
            return Err("Failed to create NSURL".to_string());
        }

        // Callback URL scheme
        let scheme_c = CString::new(AUTH_SCHEME).unwrap();
        let scheme_ns: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: scheme_c.as_ptr()];

        let auth_session_class = match Class::get("ASWebAuthenticationSession") {
            Some(class) => class,
            None => return open_url_via_application(ns_url),
        };

        let app_handle_clone = app_handle.clone();
        let block = ConcreteBlock::new(move |callback_url: *mut Object, error: *mut Object| {
            if !callback_url.is_null() {
                let url_string_ns: *mut Object = msg_send![callback_url, absoluteString];
                let url_c_str: *const i8 = msg_send![url_string_ns, UTF8String];
                if !url_c_str.is_null() {
                    let url_str = CStr::from_ptr(url_c_str).to_string_lossy().to_string();
                    handle_sign_in_url(&app_handle_clone, &url_str);
                }
            } else if !error.is_null() {
                let description: *mut Object = msg_send![error, localizedDescription];
                let c_str: *const i8 = msg_send![description, UTF8String];
                if !c_str.is_null() {
                    let error_str = CStr::from_ptr(c_str);
                    println!("[ibl.ai] ASWebAuthenticationSession error: {:?}", error_str);
                }
            }
        });
        let block = block.copy();

        let session: *mut Object = msg_send![auth_session_class, alloc];
        let session: *mut Object = msg_send![
            session,
            initWithURL: ns_url
            callbackURLScheme: scheme_ns
            completionHandler: &*block
        ];

        if session.is_null() {
            return Err("Failed to create ASWebAuthenticationSession".to_string());
        }

        // Use ephemeral (private) browser session
        let responds: BOOL =
            msg_send![session, respondsToSelector: sel!(setPrefersEphemeralWebBrowserSession:)];
        if responds == YES {
            let _: () = msg_send![session, setPrefersEphemeralWebBrowserSession: YES];
        }

        // Set presentation context provider
        let provider_class = get_context_provider_class();
        let provider: *mut Object = msg_send![provider_class, new];
        if !provider.is_null() {
            let responds_to_provider: BOOL =
                msg_send![session, respondsToSelector: sel!(setPresentationContextProvider:)];
            if responds_to_provider == YES {
                let _: () = msg_send![session, setPresentationContextProvider: provider];
            }
        }

        let started: BOOL = msg_send![session, start];
        if started == YES {
            Ok(())
        } else {
            Err("Failed to start ASWebAuthenticationSession".to_string())
        }
    }
}

// ---------------------------------------------------------------------------
// macOS: ASWebAuthenticationSession
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
#[allow(unexpected_cfgs)]
unsafe fn get_presentation_window_macos() -> *mut Object {
    let app: *mut Object = msg_send![class!(NSApplication), sharedApplication];
    let key_window: *mut Object = msg_send![app, keyWindow];
    if !key_window.is_null() {
        return key_window;
    }
    let main_window: *mut Object = msg_send![app, mainWindow];
    if !main_window.is_null() {
        return main_window;
    }
    let windows: *mut Object = msg_send![app, windows];
    let window_count: usize = msg_send![windows, count];
    if window_count > 0 {
        msg_send![windows, objectAtIndex: 0usize]
    } else {
        ptr::null_mut()
    }
}

#[cfg(target_os = "macos")]
#[allow(unexpected_cfgs)]
unsafe fn get_context_provider_class_macos() -> &'static Class {
    static REGISTER_CLASS: Once = Once::new();
    static mut CONTEXT_PROVIDER_CLASS: Option<&'static Class> = None;

    REGISTER_CLASS.call_once(|| {
        let superclass = class!(NSObject);
        let mut decl = ClassDecl::new("IBLAuthContextProviderMac", superclass).unwrap();

        extern "C" fn presentation_anchor_for_session(
            _: &Object,
            _: objc::runtime::Sel,
            _session: *mut Object,
        ) -> *mut Object {
            unsafe { get_presentation_window_macos() }
        }

        unsafe {
            decl.add_method(
                sel!(presentationAnchorForWebAuthenticationSession:),
                presentation_anchor_for_session
                    as extern "C" fn(&Object, objc::runtime::Sel, *mut Object) -> *mut Object,
            );
        }

        let class = decl.register();
        CONTEXT_PROVIDER_CLASS = Some(class);
    });

    unsafe { CONTEXT_PROVIDER_CLASS.unwrap() }
}

#[cfg(target_os = "macos")]
#[allow(unexpected_cfgs)]
fn open_with_auth_session_macos(url: &str, app_handle: &tauri::AppHandle) -> Result<(), String> {
    unsafe {
        let c_url =
            CString::new(url).map_err(|_| "Failed to create CString from URL".to_string())?;
        let ns_string: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: c_url.as_ptr()];
        if ns_string.is_null() {
            return Err("Failed to create NSString".to_string());
        }

        let ns_url: *mut Object = msg_send![class!(NSURL), URLWithString: ns_string];
        if ns_url.is_null() {
            return Err("Failed to create NSURL".to_string());
        }

        let scheme_c = CString::new(AUTH_SCHEME).unwrap();
        let scheme_ns: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: scheme_c.as_ptr()];

        let auth_session_class = match Class::get("ASWebAuthenticationSession") {
            Some(class) => class,
            None => return Err("ASWebAuthenticationSession not available".to_string()),
        };

        let app_handle_clone = app_handle.clone();
        let block = ConcreteBlock::new(move |callback_url: *mut Object, error: *mut Object| {
            if !callback_url.is_null() {
                let url_string_ns: *mut Object = msg_send![callback_url, absoluteString];
                let url_c_str: *const i8 = msg_send![url_string_ns, UTF8String];
                if !url_c_str.is_null() {
                    let url_str = CStr::from_ptr(url_c_str).to_string_lossy().to_string();
                    handle_sign_in_url(&app_handle_clone, &url_str);
                }
            } else if !error.is_null() {
                let description: *mut Object = msg_send![error, localizedDescription];
                let c_str: *const i8 = msg_send![description, UTF8String];
                if !c_str.is_null() {
                    let error_str = CStr::from_ptr(c_str);
                    println!(
                        "[ibl.ai] macOS ASWebAuthenticationSession error: {:?}",
                        error_str
                    );
                }
            }
        });
        let block = block.copy();

        let session: *mut Object = msg_send![auth_session_class, alloc];
        let session: *mut Object = msg_send![
            session,
            initWithURL: ns_url
            callbackURLScheme: scheme_ns
            completionHandler: &*block
        ];

        if session.is_null() {
            return Err("Failed to create ASWebAuthenticationSession on macOS".to_string());
        }

        let responds: BOOL =
            msg_send![session, respondsToSelector: sel!(setPrefersEphemeralWebBrowserSession:)];
        if responds == YES {
            let _: () = msg_send![session, setPrefersEphemeralWebBrowserSession: YES];
        }

        let provider_class = get_context_provider_class_macos();
        let provider: *mut Object = msg_send![provider_class, new];
        if !provider.is_null() {
            let responds_to_provider: BOOL =
                msg_send![session, respondsToSelector: sel!(setPresentationContextProvider:)];
            if responds_to_provider == YES {
                let _: () = msg_send![session, setPresentationContextProvider: provider];
            }
        }

        let started: BOOL = msg_send![session, start];
        if started == YES {
            Ok(())
        } else {
            Err("Failed to start ASWebAuthenticationSession on macOS".to_string())
        }
    }
}

// ---------------------------------------------------------------------------
// Platform router: provider sign-in via the best mechanism, anything else in
// the system browser
// ---------------------------------------------------------------------------

fn open_oauth_url(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let url_for_main = url.to_string();
        let app_handle = app.clone();
        app.run_on_main_thread(move || {
            if let Err(err) = open_with_auth_session(&url_for_main, &app_handle) {
                println!("[ibl.ai] Failed to open auth session: {}", err);
            }
        })
        .map_err(|e| format!("Failed to schedule auth session: {}", e))
    }

    #[cfg(target_os = "macos")]
    {
        if !is_oauth_url(url) {
            return app
                .opener()
                .open_url(url, None::<&str>)
                .map_err(|e| format!("Failed to open URL: {}", e));
        }
        let url_for_main = url.to_string();
        let app_handle = app.clone();
        app.run_on_main_thread(move || {
            if let Err(err) = open_with_auth_session_macos(&url_for_main, &app_handle) {
                println!("[ibl.ai] Failed to open auth session on macOS: {}", err);
            }
        })
        .map_err(|e| format!("Failed to schedule auth session: {}", e))
    }

    #[cfg(target_os = "android")]
    {
        app.opener()
            .open_url(url, None::<&str>)
            .map_err(|e| format!("Failed to open URL: {}", e))
    }

    // Windows, Linux: sign-in in the in-app popup.
    #[cfg(not(any(target_os = "ios", target_os = "android", target_os = "macos")))]
    {
        if !is_oauth_url(url) {
            return app
                .opener()
                .open_url(url, None::<&str>)
                .map_err(|e| format!("Failed to open URL: {}", e));
        }
        // Off the main thread: creating a webview inside on_navigation deadlocks WebView2.
        let (app, url) = (app.clone(), url.to_string());
        std::thread::spawn(move || {
            if let Err(err) = open_oauth_in_popup(&url, &app) {
                println!("[ibl.ai] Failed to open the sign-in popup: {}", err);
            }
        });
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tauri command: open external URL (for JS → Rust OAuth on mobile)
// ---------------------------------------------------------------------------

#[tauri::command]
async fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    open_oauth_url(&app, &url)
}

// ---------------------------------------------------------------------------
// Build-time configuration commands
//
// Both values are baked in at `cargo build` time via `option_env!`, so a single
// codebase can produce differently-configured builds by setting the env vars in
// the build shell (see build.rs `rerun-if-env-changed`). They default to the
// "off" value when the env var is unset, so a normal build is unaffected.
// ---------------------------------------------------------------------------

/// Whether this build may offer in-app purchases. Controlled by the
/// `IBL_ALLOW_IN_APP_PURCHASE` build-time env (accepts `1`/`true`/`yes`/`on`,
/// case-insensitive); returns `false` when unset.
#[tauri::command]
fn allow_in_app_purchase() -> bool {
    match option_env!("IBL_ALLOW_IN_APP_PURCHASE") {
        Some(value) => matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        None => false,
    }
}

/// The organization key this build is locked to, injected at build time via the
/// `IBL_TENANT` env var. Returns an empty string when unset (normal
/// multi-organization behaviour); a non-empty value tells the frontend to force the
/// user onto that organization and hide organization switching.
#[tauri::command]
fn get_locked_tenant() -> String {
    option_env!("IBL_TENANT").unwrap_or("").trim().to_string()
}

// ---------------------------------------------------------------------------
// Mobile initialization script: safe area CSS + OAuth interception
// ---------------------------------------------------------------------------

#[cfg(any(target_os = "ios", target_os = "android"))]
const MOBILE_INIT_SCRIPT: &str = r#"
(function() {
    if (window.__iblMobileSetup) return;
    window.__iblMobileSetup = true;

    // --- Safe area handling ---

    function waitForHead(cb) {
        if (document.head) cb();
        else setTimeout(function() { waitForHead(cb); }, 10);
    }

    waitForHead(function() {
        var viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            var content = viewport.getAttribute('content') || '';
            if (!content.includes('viewport-fit=cover')) {
                viewport.setAttribute('content', content + ', viewport-fit=cover');
            }
        } else {
            var meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
            document.head.appendChild(meta);
        }

        var style = document.createElement('style');
        style.id = 'ibl-safe-area-styles';
        style.textContent = '\
            :root {\
                --sat: env(safe-area-inset-top, 0px);\
                --sar: env(safe-area-inset-right, 0px);\
                --sab: env(safe-area-inset-bottom, 0px);\
                --sal: env(safe-area-inset-left, 0px);\
            }\
            html {\
                padding-top: env(safe-area-inset-top, 0px);\
                padding-bottom: env(safe-area-inset-bottom, 0px);\
                padding-left: env(safe-area-inset-left, 0px);\
                padding-right: env(safe-area-inset-right, 0px);\
            }\
            body {\
                position: fixed;\
                top: 0; left: 0; right: 0; bottom: 0;\
                overflow: hidden;\
            }\
            body > div:first-child, #__next, #root, main {\
                height: 100%;\
                overflow: auto;\
                -webkit-overflow-scrolling: touch;\
            }\
        ';
        document.head.appendChild(style);
    });

    function waitForBody(cb) {
        if (document.body) cb();
        else setTimeout(function() { waitForBody(cb); }, 10);
    }

    waitForBody(function() {
        // Prevent overscroll bounce on iOS
        document.body.addEventListener('touchmove', function(e) {
            var target = e.target;
            while (target && target !== document.body) {
                var s = window.getComputedStyle(target);
                if (s.overflow === 'auto' || s.overflow === 'scroll' ||
                    s.overflowY === 'auto' || s.overflowY === 'scroll') {
                    return;
                }
                target = target.parentElement;
            }
            e.preventDefault();
        }, { passive: false });
    });

    // --- OAuth URL interception ---
    // Google blocks OAuth in WebViews, so we open OAuth URLs in the system browser.

    function isOAuthUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return (
            url.includes('accounts.google.com') ||
            url.includes('google.com/o/oauth') ||
            url.includes('googleapis.com/oauth') ||
            url.includes('/auth/login/google') ||
            url.includes('/login/google') ||
            url.includes('google-oauth2') ||
            url.includes('appleid.apple.com') ||
            url.includes('/auth/login/apple') ||
            url.includes('/login/apple')
        );
    }

    function openInSystemBrowser(url) {
        if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
            window.__TAURI__.core.invoke('open_external_url', { url: url })
                .catch(function(e) {
                    console.error('[ibl.ai] Failed to open OAuth URL:', e);
                });
            return true;
        }
        return false;
    }

    // Intercept location.href assignments
    (function() {
        try {
            var hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
            if (hrefDescriptor && hrefDescriptor.set) {
                var originalHrefSetter = hrefDescriptor.set;
                Object.defineProperty(Location.prototype, 'href', {
                    get: hrefDescriptor.get,
                    set: function(url) {
                        if (isOAuthUrl(url)) {
                            var absoluteUrl = url.startsWith('/') ? this.origin + url : url;
                            if (openInSystemBrowser(absoluteUrl)) return;
                        }
                        originalHrefSetter.call(this, url);
                    },
                    configurable: true,
                    enumerable: true
                });
            }

            var originalAssign = Location.prototype.assign;
            Location.prototype.assign = function(url) {
                if (isOAuthUrl(url)) {
                    var absoluteUrl = url.startsWith('/') ? this.origin + url : url;
                    if (openInSystemBrowser(absoluteUrl)) return;
                }
                originalAssign.call(this, url);
            };

            var originalReplace = Location.prototype.replace;
            Location.prototype.replace = function(url) {
                if (isOAuthUrl(url)) {
                    var absoluteUrl = url.startsWith('/') ? this.origin + url : url;
                    if (openInSystemBrowser(absoluteUrl)) return;
                }
                originalReplace.call(this, url);
            };
        } catch (e) {
            console.error('[ibl.ai] Failed to intercept location:', e);
        }
    })();

    // Intercept window.open for OAuth popups
    var originalWindowOpen = window.open;
    window.open = function(url, target, features) {
        if (url && isOAuthUrl(url)) {
            var absoluteUrl = url.startsWith('/') ? window.location.origin + url : url;
            if (openInSystemBrowser(absoluteUrl)) return null;
        }
        return originalWindowOpen.call(window, url, target, features);
    };

    // Click interceptor as backup
    document.addEventListener('click', function(e) {
        var target = e.target;
        var depth = 0;
        while (target && depth < 10) {
            if (target.tagName === 'A' && target.href && isOAuthUrl(target.href)) {
                e.preventDefault();
                e.stopPropagation();
                openInSystemBrowser(target.href);
                return false;
            }
            target = target.parentElement;
            depth++;
        }
    }, true);
})();
"#;

// ---------------------------------------------------------------------------
// Desktop: sign-in popup (Windows, Linux — macOS uses ASWebAuthenticationSession)
// ---------------------------------------------------------------------------

/// Open a provider sign-in in a popup window. The callback, or a return to
/// the app, is handed to the main window through its guard and the popup closes.
#[cfg(not(any(target_os = "ios", target_os = "android", target_os = "macos")))]
fn open_oauth_in_popup(url: &str, app_handle: &tauri::AppHandle) -> Result<(), String> {
    let target: tauri::Url = url.parse().map_err(|e| format!("Invalid URL: {}", e))?;
    if let Some(popup) = app_handle.get_webview_window("oauth-popup") {
        popup
            .navigate(target)
            .map_err(|e| format!("Failed to reuse the sign-in popup: {}", e))?;
        let _ = popup.set_focus();
        return Ok(());
    }

    let app = app_handle.clone();
    let app_url = configured_app_url(app_handle.config());
    let app_host = configured_app_host(app_handle.config());
    WebviewWindowBuilder::new(
        app_handle,
        "oauth-popup",
        tauri::WebviewUrl::External(target),
    )
    .title("Sign In")
    .inner_size(500.0, 700.0)
    .center()
    .focused(true)
    .on_navigation(move |nav_url| {
        // A sign-in return on either scheme completes; so does a callback or a return to the app.
        let sign_in = app_url.as_ref().and_then(|a| sign_in_return(nav_url, a));
        if sign_in.is_none() {
            // The provider's own pages (and the paths that start them) stay in the popup.
            if is_oauth_url(nav_url.as_str()) {
                return true;
            }
            let host = nav_url.host_str().unwrap_or("");
            let is_callback = host.eq_ignore_ascii_case("login.iblai.app")
                && (nav_url.path().contains("/callback")
                    || nav_url.query().is_some_and(|q| {
                        q.contains("code=") || q.contains("token=") || q.contains("access_token=")
                    }));
            let is_app_return = app_host
                .as_deref()
                .is_some_and(|app| app.eq_ignore_ascii_case(host));
            if !(is_callback || is_app_return) {
                return true;
            }
        }
        let target = sign_in.unwrap_or_else(|| nav_url.clone());
        // Off this thread: the hand-off and the close must not run inside the popup's handler.
        let app = app.clone();
        std::thread::spawn(move || {
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.navigate(target);
                let _ = main_win.set_focus();
            }
            if let Some(popup) = app.get_webview_window("oauth-popup") {
                let _ = popup.close();
            }
        });
        false
    })
    .build()
    .map_err(|e| format!("Failed to create the sign-in popup: {}", e))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            open_external_url,
            allow_in_app_purchase,
            get_locked_tenant
        ])
        .setup(|app| {
            // ---- Mobile: deep-link listeners ----
            #[cfg(any(target_os = "ios", target_os = "android"))]
            {
                let app_handle = app.handle().clone();
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    for url in urls {
                        handle_sign_in_url(&app_handle, url.as_str());
                    }
                }

                let app_handle = app.handle().clone();
                app.listen("deep-link://new-url", move |event: tauri::Event| {
                    if let Ok(urls) = serde_json::from_str::<Vec<String>>(event.payload()) {
                        for url in urls {
                            handle_sign_in_url(&app_handle, &url);
                        }
                    }
                });
            }

            // ---- Desktop: main window on the deployed app, guarded ----
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            {
                let app_handle = app.handle().clone();
                let app_url = configured_app_url(app.config());
                let app_host = configured_app_host(app.config());

                let _window = WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("My App")
                .inner_size(1200.0, 800.0)
                .center()
                .on_navigation(move |url| {
                    // A sign-in return (either scheme) lands on the app; checked
                    // first, its payload can contain a provider's name.
                    if let Some(target) = app_url.as_ref().and_then(|a| sign_in_return(url, a)) {
                        if let Some(main) = app_handle.get_webview_window("main") {
                            go_to(main, target);
                        }
                        return false;
                    }
                    // Provider sign-in → the platform-appropriate mechanism
                    if is_oauth_url(url.as_str()) {
                        let _ = open_oauth_url(&app_handle, url.as_str());
                        return false;
                    }
                    let allowed = allowed_nav(url, app_host.as_deref());
                    if !allowed {
                        // The origin only: a query can carry the session.
                        println!(
                            "[ibl.ai] blocked navigation: {}/",
                            url.origin().ascii_serialization()
                        );
                    }
                    allowed
                })
                .build()?;
            }

            // ---- Mobile: main window with safe-area + OAuth interception ----
            #[cfg(any(target_os = "ios", target_os = "android"))]
            {
                let app_handle = app.handle().clone();
                let app_url = configured_app_url(app.config());

                let window = WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .initialization_script(MOBILE_INIT_SCRIPT)
                .on_navigation(move |url| {
                    // A sign-in return inside the webview (the WebView cannot load
                    // the scheme itself); checked before the provider patterns.
                    if let Some(target) = app_url.as_ref().and_then(|a| sign_in_return(url, a)) {
                        if let Some(main) = app_handle.get_webview_window("main") {
                            go_to(main, target);
                        }
                        return false;
                    }
                    let url_str = url.as_str();
                    if is_oauth_url(url_str) {
                        let _ = open_oauth_url(&app_handle, url_str);
                        return false;
                    }
                    true
                })
                .build()
                .expect("Failed to create main window");

                // A deep link that arrived before the window existed
                if let Ok(mut pending) = get_pending_deep_link().lock() {
                    if let Some(pending_url) = pending.take() {
                        go_to(window, pending_url);
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(all(test, not(any(target_os = "ios", target_os = "android"))))]
mod tests {
    use super::{allowed_nav, sign_in_return};

    fn u(s: &str) -> tauri::Url {
        s.parse().unwrap()
    }

    #[test]
    fn a_sign_in_return_on_either_scheme_lands_on_the_app() {
        let app = u("https://my-app.example.com/");
        let back = |s: &str| sign_in_return(&u(s), &app).map(|t| t.to_string());
        assert_eq!(
            back("my-app:///sso-login-complete?redirect-path=/p/x?y=1&data=%7B%7D"),
            Some(
                "https://my-app.example.com/sso-login-complete?redirect-path=/p/x?y=1&data=%7B%7D"
                    .into()
            )
        );
        assert_eq!(
            back("iblai-mentor:///sso-login-complete?data=%7B%7D&redirect-path=/"),
            Some(
                "https://my-app.example.com/sso-login-complete?data=%7B%7D&redirect-path=/".into()
            )
        );
        assert_eq!(
            back("my-app://sso-login-complete?data=x"),
            Some("https://my-app.example.com/sso-login-complete?data=x".into())
        );
        assert_eq!(
            back("my-app:///mobile-sso-login?data=x"),
            Some("https://my-app.example.com/mobile-sso-login?data=x".into())
        );
        assert_eq!(
            back("https://my-app.example.com/sso-login-complete?data=x"),
            None
        );
        assert_eq!(back("my-app:///settings?data=x"), None);
        assert_eq!(back("my-app://?data=x"), None);
    }

    #[test]
    fn the_app_host_the_platform_and_the_webview_origins_are_allowed() {
        let app = Some("my-app.example.com");
        assert!(allowed_nav(&u("https://my-app.example.com/admin?x=1"), app));
        assert!(allowed_nav(&u("https://MY-APP.example.com/"), app));
        assert!(allowed_nav(
            &u("https://login.iblai.app/login?app=custom"),
            None
        ));
        assert!(allowed_nav(&u("https://api.iblai.org/dm/api/"), None));
        assert!(allowed_nav(&u("https://js.stripe.com/v3/"), None));
        assert!(allowed_nav(&u("http://localhost:3000/"), None));
        assert!(allowed_nav(&u("http://tauri.localhost/index.html"), None));
        assert!(allowed_nav(&u("tauri://localhost/index.html"), None));
    }

    #[test]
    fn other_hosts_lookalikes_and_hostless_urls_are_blocked() {
        let app = Some("my-app.example.com");
        assert!(!allowed_nav(
            &u("https://evil.example.com/?r=.iblai.app"),
            app
        ));
        assert!(!allowed_nav(
            &u("https://my-app.example.com.evil.net/"),
            app
        ));
        assert!(!allowed_nav(&u("https://notiblai.app/"), None));
        assert!(!allowed_nav(&u("https://evil.example.com/"), None));
        assert!(!allowed_nav(&u("about:blank"), None));
        assert!(!allowed_nav(&u("data:text/html,hi"), None));
    }
}
