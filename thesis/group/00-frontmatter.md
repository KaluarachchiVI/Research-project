# ADAPTIVE COGNITIVE-LOAD STUDY TIMER FOR PERSONALIZED BREAK SCHEDULING

Project ID: 25-26J-458  
Dissertation submitted in partial fulfillment of the requirements for the B.Sc. (Hons) Degree in Information Technology  
Department of Information Technology  
Sri Lanka Institute of Information Technology  
Sri Lanka  
April 2026

\newpage

# Declaration of the Candidate and Supervisor

We declare that this dissertation is our own work and does not incorporate without acknowledgment any material previously submitted for a Degree or Diploma in any other University or institute of higher learning, and to the best of our knowledge and belief it does not contain any material previously published or written by another person except where acknowledgement is made in the text.

| Candidate Name | Student ID | Signature | Date |
|---|---|---|---|
| Bogahawatta B. P. S. | IT22148254 |  |  |
| Kaluarachchi V. I. | IT22054418 |  |  |
| Rajendram P. A. | IT22087874 |  |  |
| Yasasvin W. M. Y. | IT22276582 |  |  |

Supervisor Statement:  
The above candidates have carried out research for the bachelor’s degree dissertation under my supervision.

Supervisor: Dr. Kalpani Manathunga  
Co-Supervisor: Mr. Eishan  
Signatures: ____________________

\newpage

# Abstract

Traditional study timers enforce static work–break cycles and offer little adaptation to fluctuating cognitive demand, irregular study rhythms, or impulsive task switching. This dissertation presents an integrated platform, the **Adaptive Cognitive-Load Study Timer**, that personalises study support through behavioural sensing, online learning, temporal profiling, and distraction-aware intervention. The system comprises four cooperating microservices: (1) a privacy-first **Cognitive Load Estimator (CLE)** running a 14-dimensional passive feature pipeline at 60-second window and 15-second hop, fused with sparse 1–7 Likert micro-EMA labels through a scalar Kalman filter with recursive least-squares observation-weight adaptation; (2) an **Adaptive Break Scheduler** that selects from a 16-arm `(work, break)` action space using LinUCB or Thompson Sampling under a `0.6 R_progress + 0.4 R_relief` reward; (3) a **Chronotype-aware Time-of-Day Recommender** that runs a `mabwiser` LinUCB policy over four time-of-day arms with sleep-history context, plus an optional Gradient Boosting Regressor weekly hybrid; and (4) an **Intent-Lock Overlay** that classifies exit attempts as impulsive or genuine using `LogisticRegression` and applies three-level graduated friction governed by repeated-attempt counts.

The architecture follows a hybrid edge–cloud deployment: a local Python OS-hooks agent captures interaction metadata; four containerisable services process state estimation, scheduling, time-of-day recommendation, and exit-intent classification; and a Next.js UI subscribes to a Server-Sent Events stream for live load. The methodology combines design science with quantitative and qualitative evaluation, using an eight-metric harness — Personalisation Gain, Regret-per-Hour, Adaptation Half-Life, Exploration Overhead Index, Break Utility Curve and AUC-BUC, Counterfactual Targeting Uplift, Stability–Productivity Frontier variance, and Safety Violation Rate — alongside NASA-TLX and reflection-log themes. The expected contribution is a deployable and privacy-aware educational-technology framework that couples real-time cognitive sensing to actionable intervention while remaining interpretable to users and scalable for institutional adoption.

**Keywords:** adaptive learning, cognitive load estimation, micro-EMA, contextual bandits, chronotype, distraction prevention, graduated friction, hybrid edge-cloud deployment

\newpage

# Acknowledgements

The authors gratefully acknowledge Dr. Kalpani Manathunga for continuous guidance, critical feedback, and research supervision throughout this project. We also thank Mr. Eishan for technical direction during integration and implementation phases. We appreciate the support from the Department of Information Technology, Sri Lanka Institute of Information Technology, for providing the academic environment and resources required for this work.

Special thanks are extended to peers and pilot users who contributed to prototype evaluations and constructive feedback. Their participation helped refine the system design, improve usability decisions, and align research outputs with practical student needs.

\newpage

# Table of Contents

This section is automatically generated in Word/Pandoc build.

\newpage

# List of Figures

This section is automatically generated in Word/Pandoc build.

\newpage

# List of Tables

This section is automatically generated in Word/Pandoc build.

\newpage

# List of Abbreviations

| Abbreviation | Meaning |
|---|---|
| AHL | Adaptation Half-Life |
| API | Application Programming Interface |
| AUC-BUC | Area Under the Break Utility Curve |
| BUC | Break Utility Curve |
| CLE | Cognitive Load Estimator |
| CTU | Counterfactual Targeting Uplift |
| DnD | Do Not Disturb |
| EMA | Ecological Momentary Assessment |
| EOI | Exploration Overhead Index |
| EWMA | Exponentially Weighted Moving Average |
| FR | Functional Requirement |
| GBR | Gradient Boosting Regressor |
| HCI | Human–Computer Interaction |
| IKI | Inter-Key Interval |
| IPS | Inverse Propensity Scoring |
| JITAI | Just-in-Time Adaptive Intervention |
| LR | Logistic Regression |
| MAB | Multi-Armed Bandit |
| MAE | Mean Absolute Error |
| MEQ | Morningness–Eveningness Questionnaire (future work) |
| NASA-TLX | NASA Task Load Index |
| NFR | Non-Functional Requirement |
| PG | Personalisation Gain |
| RLS | Recursive Least Squares |
| RPH | Regret-per-Hour |
| SDK | Software Development Kit |
| SPF | Stability–Productivity Frontier |
| SPF-Var | SPF Variance |
| SSE | Server-Sent Events |
| SVR | Safety Violation Rate |
| TLX | Task Load Index |
| UI | User Interface |
