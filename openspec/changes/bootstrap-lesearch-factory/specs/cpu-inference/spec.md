## ADDED Requirements

### Requirement: Modular inference adapters
The inference library SHALL define a single `InferenceBackend` interface (load, generate, embed, health) and provide swappable adapters, including an `ollama` adapter and a `llama.cpp` adapter, selectable by configuration.

#### Scenario: Select a backend by config
- **WHEN** the inference library is configured with `backend: "ollama"`
- **THEN** calls route to the ollama adapter and `health()` reports the adapter's reachability as a typed status

### Requirement: GGUF model support on CPU
The inference library SHALL run GGUF-format models on CPU with no GPU requirement, so any machine can perform inference.

#### Scenario: Generate on a CPU-only host
- **WHEN** a GGUF model is loaded on a host with no GPU and a generation request is made
- **THEN** the library returns generated text via the configured CPU backend

### Requirement: Uniform health reporting
Each adapter SHALL report health as one of `ok | degraded | unavailable | not_configured | unknown` so the control plane can aggregate inference status uniformly.

#### Scenario: Backend not installed
- **WHEN** the configured backend binary or server is absent
- **THEN** `health()` returns `not_configured` (not a crash) with a remediation hint
