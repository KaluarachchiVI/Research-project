# Deployment Strategy for Adaptive Learning System

## Overview

The latest integration consists of a distributed architecture with multiple distinct components:

1. **Cognitive load estimator** (Python REST API - port 8000)
2. **Adaptive break Scheduler** (Python Flask API - port 5000)
3. **Predictive contextual heatmap** (Python FastAPI - port 5001)
4. **Intent Lock overlay** (FastAPI Backend + ML Inference and React Frontend integration)
5. **Web UI** (Next.js Application - port 3000, including the Intent Lock overlay component)
6. **OS Hooks Client** (Native Executable capturing local system events)

Given the combination of multiple web services and a native client requirement, the system requires a **Hybrid Edge-Cloud Deployment Strategy** backed by **Containerization (Docker)**.

## The Deployment Strategy: Hybrid Edge-Cloud with Containerization

This strategy separates the deployment into two distinct environments: the User's Local Machine (Edge) and the Centralized Server (Cloud or On-Premise Data Center).

### 1. Cloud/Server Deployment (The Backend & UI Suite)

All web-facing services, backend processing, and ML inference pipelines (including the Intent Lock overlay prediction model) will be containerized and orchestrated centrally.

- **Containerization (Docker):** Each backend component (Cognitive load estimator, Adaptive break Scheduler, Predictive contextual heatmap, Intent Lock overlay) and the Next.js Web UI is packaged into its isolated Docker container. This ensures that Python versions, Node.js environments, and ML dependencies (like scikit-learn for Intent Lock overlay) do not conflict.
- **Orchestration:**
  - _Phase 1 (MVP/Small Scale):_ Use **Docker Compose** on a single virtual machine (e.g., AWS EC2, DigitalOcean Droplet) to define and run the multi-container application. A reverse proxy (Nginx or Traefik) handles routing external traffic to the correct ports mapping.
  - _Phase 2 (Production/Large Scale):_ Migrate to **Kubernetes (K8s)** to manage the containers across a cluster. This allows individual components (e.g., the Predictive contextual heatmap study prediction backend or the Intent Lock overlay ML inference endpoints) to scale independently via Horizontal Pod Autoscalers.
- **Database & State Management:** Databases (SQLite currently spanning across Cognitive load estimator, Adaptive break Scheduler, and Intent Lock overlay systems, but scalable to PostgreSQL or Redis) should be mounted via external managed database services (e.g., AWS RDS) or persistent volumes attached to the containers, ensuring data survives container restarts.

### 2. Edge Deployment (The OS Hooks Client)

The OS Hooks component relies on low-level operating system APIs to capture keystrokes and pointer events. This cannot run in a cloud container or browser sandbox.

- **Local Installation:** The `cle-os-hooks.exe` is deployed directly to the user's machine (Windows/Mac/Linux native binaries).
- **Configuration:** The local client is configured to send its telemetry data securely over HTTPS to the Cloud's Cognitive load estimator endpoint (e.g., `https://api.yourdomain.com/praboth/events`).
- **Distribution:** This can be distributed as a standalone lightweight desktop installer, potentially paired with an auto-updater mechanism.

---

## Pros and Cons of the Strategy

### Pros

- **Scalability & Resource Efficiency:** By using Docker/Kubernetes in the cloud, heavy ML computation or data aggregation tasks happening in the Intent Lock overlay, Predictive contextual heatmap, or Cognitive load estimator backends can be scaled horizontally without affecting the Next.js UI performance or adding latency to the Intent Lock overlay friction modal.
- **Environment Consistency:** "It works on my machine" issues are eliminated. The codebase runs identically in development, staging, and production because the entire environment is packaged within the Docker image.
- **Security & Isolation:** The database and internal APIs (like the Adaptive break Scheduler API and Intent Lock overlay model API) don't need to be exposed to the public internet. They can communicate within a private Docker/K8s virtual network, exposing only the Next.js UI (where the Intent Lock overlay handles the user interaction) and the specific event ingestion endpoints to the public.

* **Accommodates Native Constraints:** It respects the hard constraint that OS-level keystroke logging must happen locally on the user's specific hardware.

### Cons

- **Operational Complexity:** Managing Docker images, CI/CD pipelines, and network routing for 4 distinct services is more complex than deploying a single monolithic application.
- **Client-Server Latency:** In the current script, OS hooks talk to localhost. In a cloud deployment, hooks will send data over the internet, introducing latency and requiring robust handling of intermittent network disconnections.
- **Edge Updating:** Maintaining and pushing updates to the local OS Hooks executable installed on various users' machines is historically difficult compared to updating a centralized web server.

---

## Reason for Choosing This Strategy

This strategy is chosen primarily because it is the **most resilient and generic approach to accommodate future complications.**

1. **Polyglot Complexity:** The integration currently uses overlapping tech stacks (multiple independent Python APIs running on different frameworks like Flask and Uvicorn, plus Node.js). If a future component requires Go-lang or Java, containerization handles this seamlessly without polluting the host server.
2. **Coupling constraints:** The `start_all_services.ps1` script reveals a heavily coupled local environment. Moving this to a cloud environment _requires_ containerization to safely manage the varying dependencies of the 4 APIs without port or environment variable collisions.
3. **The Edge Requirement:** The project fundamentally relies on the OS Hooks executable. We _must_ adopt a Hybrid approach; we cannot force the OS Hooks into the cloud, and running the heavy Next.js and ML backends locally on every user's machine is computationally expensive and fragile (as seen by the 15-30 second compilation times and reliance on specific local Python environments). Splitting the architecture into a lightweight edge agent and a robust cloud backend maximizes user performance and system reliability.
