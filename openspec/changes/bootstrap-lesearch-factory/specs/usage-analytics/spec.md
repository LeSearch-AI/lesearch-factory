## ADDED Requirements

### Requirement: Anonymous opt-in telemetry
The system SHALL emit anonymous usage analytics (PostHog) describing feature usage and component health, and SHALL be disableable with a single environment flag. It SHALL NOT transmit code, prompts, file contents, or secrets.

#### Scenario: Telemetry disabled
- **WHEN** `LESEARCH_TELEMETRY=0` is set
- **THEN** no analytics events are sent and the system functions normally

#### Scenario: Event payload is safe
- **WHEN** a telemetry event is emitted for a feature use
- **THEN** the payload contains only an anonymous install id, the event name, and non-sensitive properties — never code, prompts, or secrets

### Requirement: Install-time disclosure
The installer SHALL print a clear notice that anonymous analytics are enabled by default and how to opt out before completing installation.

#### Scenario: Notice shown on install
- **WHEN** the install script runs
- **THEN** it prints the analytics notice and the opt-out instruction
