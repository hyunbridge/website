mod auth;
mod config;
mod content_repo;
mod editorial;
mod error;
mod models;
mod notion;
mod object_storage;
mod routes;
mod state;

use std::env;
use std::error::Error;
use std::io::{self, Read};

use crate::config::AppConfig;
use crate::error::AppInitError;
use crate::state::AppState;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let config = AppConfig::load()?;
    init_tracing(&config)?;

    let args: Vec<String> = env::args().collect();
    if matches!(args.get(1).map(String::as_str), Some("init-admin")) {
        return run_init_admin(config, &args[2..]).await;
    }

    config.validate_for_server()?;

    let bind_addr = config.bind_addr();
    let state = AppState::new(config).await?;
    let app = routes::build_router(state.clone());
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;

    info!(
        addr = %bind_addr,
        env = %state.config.app_env,
        "starting rust api server"
    );

    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing(config: &AppConfig) -> Result<(), AppInitError> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new(config.log_filter_directive())),
        )
        .json()
        .try_init()
        .map_err(|err| AppInitError::new(err.to_string()))?;
    Ok(())
}

async fn run_init_admin(config: AppConfig, args: &[String]) -> Result<(), Box<dyn Error>> {
    let command = parse_init_admin_args(args)?;
    AppState::install_admin(
        config.clone(),
        &command.admin_email,
        &command.admin_password,
    )
    .await?;
    info!(
        admin_email = %command.admin_email,
        mongo_database = %config.mongo_database_name,
        "backend installation completed"
    );
    Ok(())
}

struct InitAdminCommand {
    admin_email: String,
    admin_password: String,
}

fn parse_init_admin_args(args: &[String]) -> Result<InitAdminCommand, AppInitError> {
    let mut admin_email = String::new();
    let mut admin_password = String::new();
    let mut password_from_stdin = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--admin-email" | "-admin-email" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(AppInitError::new("missing value for --admin-email"));
                };
                admin_email = value.trim().to_owned();
            }
            "--admin-password" | "-admin-password" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(AppInitError::new("missing value for --admin-password"));
                };
                admin_password = value.trim().to_owned();
            }
            "--admin-password-stdin" | "-admin-password-stdin" => {
                password_from_stdin = true;
            }
            "--help" | "-h" => {
                print_init_admin_help();
                std::process::exit(0);
            }
            unknown => {
                return Err(AppInitError::new(format!("unknown argument: {unknown}")));
            }
        }
        index += 1;
    }

    if password_from_stdin {
        let mut buffer = String::new();
        io::stdin().read_to_string(&mut buffer).map_err(|err| {
            AppInitError::new(format!("failed to read admin password from stdin: {err}"))
        })?;
        admin_password = buffer.trim().to_owned();
    }

    if admin_email.is_empty() || admin_password.is_empty() {
        return Err(AppInitError::new(
            "init-admin requires --admin-email and either --admin-password or --admin-password-stdin",
        ));
    }

    Ok(InitAdminCommand {
        admin_email,
        admin_password,
    })
}

fn print_init_admin_help() {
    eprintln!(
        "usage: cargo run -- init-admin --admin-email <email> [--admin-password <password> | --admin-password-stdin]"
    );
}
