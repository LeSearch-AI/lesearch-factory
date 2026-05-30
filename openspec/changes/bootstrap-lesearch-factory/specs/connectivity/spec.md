## ADDED Requirements

### Requirement: Cloudflared tunnel access
The system SHALL provide an optional `tunnel` compose profile that exposes the gateway/WebUI over a cloudflared tunnel, giving a reachable URL from any device without opening inbound ports.

#### Scenario: Enable the tunnel
- **WHEN** a user starts the stack with the `tunnel` profile and a configured cloudflared token
- **THEN** a public tunnel URL is established and reported via `lesearch status`, and the `tunnel` component reads `ok`

#### Scenario: Tunnel not configured
- **WHEN** the tunnel profile is not enabled
- **THEN** the `tunnel` component reports `not_configured` and the rest of the stack runs normally

### Requirement: Terminal access via rmux
The system SHALL provide terminal access to the workspace through rmux, surfaced in the WebUI and over the tunnel.

#### Scenario: Open a terminal session
- **WHEN** a user opens the terminal in the WebUI
- **THEN** an rmux-backed shell session attaches and accepts input

### Requirement: Optional SSH and VNC profiles
The system SHALL provide optional `ssh` (sshd) and `vnc` (noVNC) compose profiles for shell and GUI access, disabled by default and enabled per-profile.

#### Scenario: Enable SSH profile
- **WHEN** a user starts the stack with the `ssh` profile
- **THEN** an sshd service accepts authenticated connections and is reported in `lesearch status`

#### Scenario: GUI access via VNC
- **WHEN** a user enables the `vnc` profile and opens the noVNC endpoint
- **THEN** a desktop session is reachable in the browser
