# Agentic UX

A lightweight, agent-assisted workflow to plan, build, audit, and reuse UI at scale.

## Components

### 1) UX Architect (AI)

Turns business goals and input data into an execution UI building plan: information architecture, user flows, page/component maps, and testable specs for the Builder.

* **Inputs:** goals, user stories, constraints, data to render
* **Outputs:** UI Layout, containers, components and user interaction flows. As well as building plan, acceptance criteria, etc

### 2) UI Builder (AI)

Assembles screens from the plan, generating responsive layouts and production-ready code with tokens, states, and interactions wired.

* **Inputs:** Architect plan, Component Library
* **Outputs:** Live UI with Interaction

### 3) UI Inspector (AI)

Continuously audits builds for accessibility, performance, semantics, and design-system compliance; flags issues and proposes one-click fixes.

* **Inputs:** Output from UI Builder, and UX Architect
* **Outputs:** Findings report, auto-fix suggestions, gating checks

### 4) UI Component Library

The versioned, documented catalog of reusable components, templates, and tokens—the single source of truth across products.

* **Includes:** Components, templates, tokens, usage docs
* **Guarantees:** Versioning, ownership, compatibility notes

## Workflow at a Glance

1. **Architect →** produce plan & specs
2. **Builder →** generate UI from specs
3. **Inspector →** audit & auto-fix
4. **Library →** publish/update components for reuse

## Minimal Success Criteria

* Architect delivers clear, testable specs
* Builder outputs compile-clean, responsive UI
* Inspector enforces A11y/Perf/Design-system gates
* Library tracks versions and adoption across apps
