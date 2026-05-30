## ADDED Requirements

### Requirement: Mission-control dashboard
The WebUI SHALL present a monochrome dashboard (per the LeSearch design system) showing overall system status, each component's typed health, and the list of active runs and sessions.

#### Scenario: Dashboard reflects live status
- **WHEN** a user opens the WebUI while the stack is running
- **THEN** the dashboard shows each component's status sourced from `GET /status` and updates as statuses change

### Requirement: Live session and log view
The WebUI SHALL subscribe to the gateway event stream and render run/session lifecycle transitions and log lines in real time.

#### Scenario: A run starts while the UI is open
- **WHEN** an agent run starts and the dashboard is open
- **THEN** the new run and its sessions appear without a manual refresh

### Requirement: Approval surface
The WebUI SHALL render pending approval requests and let the user allow or deny them, sending the decision back to the gateway.

#### Scenario: User approves from the UI
- **WHEN** a session is `waiting_approval` and the user clicks allow
- **THEN** the gateway receives the allow decision and the session resumes

### Requirement: Cross-device rendering
The WebUI SHALL be responsive so it is usable from a phone or tablet over the cloudflared tunnel.

#### Scenario: Open on a phone
- **WHEN** the WebUI is opened on a narrow viewport via the tunnel URL
- **THEN** the dashboard remains legible and the primary controls remain reachable
