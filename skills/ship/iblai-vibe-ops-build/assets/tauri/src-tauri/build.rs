fn main() {
    // `option_env!` bakes these in at compile time, so cargo must rebuild when
    // they change between builds. See the `allow_in_app_purchase` /
    // `get_locked_tenant` commands in src/lib.rs.
    println!("cargo:rerun-if-env-changed=IBL_ALLOW_IN_APP_PURCHASE");
    println!("cargo:rerun-if-env-changed=IBL_TENANT");
    tauri_build::build()
}
