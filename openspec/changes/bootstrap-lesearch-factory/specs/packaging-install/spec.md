## ADDED Requirements

### Requirement: Single-command install
The system SHALL provide a single `curl -fsSL https://lesearch.ai/install | sh` command that installs a thin `lesearch` CLI binary, detecting the host OS and architecture and placing the binary on an install-dir priority chain (`$LESEARCH_INSTALL_DIR` → `$XDG_BIN_DIR` → `$HOME/.local/bin` → `$HOME/.lesearch/bin`).

#### Scenario: Install on a supported host
- **WHEN** a user runs the install command on macOS (arm64/x64) or Linux (arm64/x64)
- **THEN** the `lesearch` binary is installed to the first writable install dir and `lesearch --version` prints the version with exit code 0

#### Scenario: Unsupported platform
- **WHEN** the host OS/arch is not supported
- **THEN** the installer exits non-zero with a clear message naming the detected platform and the supported set

### Requirement: First-class uninstall
The system SHALL provide a `lesearch uninstall` command that removes the binary, containers, and volumes, with flags `--keep-config`, `--keep-data`, `--dry-run`, and `--force`.

#### Scenario: Dry-run uninstall
- **WHEN** a user runs `lesearch uninstall --dry-run`
- **THEN** the command lists every file, container, and volume it would remove and makes no changes, exiting 0

#### Scenario: Data-preserving uninstall
- **WHEN** a user runs `lesearch uninstall --keep-data`
- **THEN** the CLI binary and containers are removed but the Postgres data volume is retained

### Requirement: One-command stack bring-up
The system SHALL bring the full stack up with `lesearch up`, which wraps `docker compose up -d` over the core profile (gateway, postgres, webui) and SHALL bring it down with `lesearch down`.

#### Scenario: Bring the stack up
- **WHEN** a user runs `lesearch up` with Docker available
- **THEN** the gateway, postgres, and webui containers start and `lesearch status` reports each as `ok` within the readiness timeout

### Requirement: Doctor preflight
The system SHALL provide `lesearch doctor` that verifies prerequisites (Docker daemon reachable, required ports free, install dir writable) and reports each as a typed status with a numeric code.

#### Scenario: Docker not running
- **WHEN** `lesearch doctor` runs and the Docker daemon is unreachable
- **THEN** it reports the docker check as `unavailable` with a remediation hint and exits non-zero

### Requirement: Versioned schema contract
The repository SHALL define versioned JSON Schemas under `schemas/lesearch.<domain>.vN.schema.json`, and all packages SHALL validate their data against these schemas.

#### Scenario: Schema validation in CI
- **WHEN** the test suite runs
- **THEN** every schema file parses as valid JSON Schema and the `proto` package's generated validators match the schema versions
