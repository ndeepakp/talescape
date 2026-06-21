# Deploying Talerooms to AWS ECS (Fargate)

This document explains everything needed to take Talerooms from "runs on a laptop"
to "running on AWS ECS Fargate behind a real domain."

ECS Fargate is a production-grade choice, but it is one of the heavier ways to run a
Next.js app — you assemble roughly ten separate AWS services. AWS App Runner does
almost the same thing (container → public HTTPS URL) with far less setup, and **all of
the app-side preparation in Part A is identical either way**, so none of that work is
wasted if you start simpler and graduate to ECS later.

- **ECS** runs Docker containers for you.
- **Fargate** is the mode where AWS runs the underlying servers, so you never manage a
  virtual machine. The app is packaged into a container image; Fargate runs copies of it.

---

## Target architecture

![Talerooms on AWS ECS Fargate architecture](docs/architecture.svg)

<details>
<summary>Text version of the diagram</summary>

```
Reader's browser
      │  HTTPS
      ▼
Route 53 + ACM            (domain + TLS certificate)
      │
      ▼
Application Load Balancer  (public subnet, health checks, HTTPS termination)
      │
      ▼
ECS Fargate               (Next.js container, private subnet)
      ├──────────────► RDS PostgreSQL + pgvector   (private subnet)
      ├──────────────► S3 bucket                    (avatars + wallpapers)
      ├──────────────► Secrets Manager              (db url, auth secret)
      └──────────────► CloudWatch                   (logs + alarms)

ECR (container image registry) ──deploy image──► ECS Fargate
```

</details>

---

## Part A — Changes needed inside the app

These make the app container-ready. They are required for **any** container host, not
just ECS.

1. **Dockerfile + standalone build.** Set `output: "standalone"` in `next.config.ts` to
   produce a slim self-contained server, then add a multi-stage Dockerfile
   (install deps → build → minimal Node 20 runtime). `sharp` works fine in containers.

2. **Move uploads to S3 — the real blocker.** Avatars and feed wallpapers are currently
   written to the local `public/uploads/` folder. In ECS this breaks two ways: container
   disks are wiped on every redeploy, and with 2+ containers each has its own disk, so an
   upload on one is invisible to the others. Send uploaded files to an S3 bucket (shared
   object storage) and store the resulting URL on the user row. This is a rewrite of one
   upload helper; keep a local-disk fallback for development.

3. **Move config to environment variables / secrets.** Externalize `DATABASE_URL`,
   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the real domain), and the S3 bucket name and
   region. In production these come from AWS Secrets Manager, injected at container start.

4. **Database migration plan.** The schema lives in hand-run `db/00NN_*.sql` files.
   Against a cloud database you need a repeatable way to apply them — either a one-off ECS
   "run task" that executes the SQL, or a migration step in the deploy pipeline.

5. **Health check route.** The load balancer pings the app to confirm it is alive before
   sending traffic. A trivial `/api/health` that returns `200 OK` is enough.

6. **Auth hardening for a real domain.** Set better-auth's base URL and trusted origins to
   the production domain, and mark cookies secure. Sessions fail silently otherwise.

---

## Part B — The AWS pieces

| Piece | What it is for |
|---|---|
| **ECR** | Private registry that stores your container image; ECS pulls from it. |
| **RDS PostgreSQL** | Managed database replacing local Postgres. Enable the `pgvector` extension (RDS supports it). Lives in a private subnet. |
| **S3 bucket** | Stores uploaded images. Optionally front it with CloudFront (CDN) for speed. |
| **Secrets Manager** | Holds DB password, auth secret, etc., injected into the container. |
| **VPC + subnets** | Private network. Public subnets hold the load balancer; private subnets hold the app and database. Needs a NAT gateway so private containers can reach the internet. |
| **Security groups** | Firewall rules: load balancer → app on the app port; app → database on 5432; nothing else. |
| **ECS cluster + task definition + service** | The cluster is the logical home; the task definition describes one container (image, CPU/memory, env, logs); the service keeps N copies alive and does rolling deploys. |
| **Application Load Balancer (ALB)** | Public front door. Spreads traffic across containers, runs health checks, terminates HTTPS. |
| **ACM + Route 53** | ACM issues the free TLS certificate; Route 53 points the domain at the load balancer. |
| **IAM roles** | An execution role (lets ECS pull the image and read secrets) and a task role (lets the app talk to S3). |
| **CloudWatch** | Collects container logs and lets you set alarms. |

---

## The deploy flow

1. Build the Docker image (locally or in CI).
2. Push it to ECR.
3. Register a new task definition pointing at that image.
4. Update the ECS service → it rolls out new containers behind the ALB and drains old ones.
5. Run the DB migrations against RDS.
6. Point the domain (Route 53) at the ALB.

Automate steps 1–4 with GitHub Actions so a `git push` ships a new version.

---

## Don't build this by clicking the console

Hand-building ten services in the AWS web console is error-prone and unrepeatable. Two
saner routes:

- **AWS Copilot CLI** — purpose-built to deploy containers to ECS. One small config file
  creates the VPC, ALB, ECS service, ECR, and roles for you. Easiest on-ramp to ECS.
- **Terraform or AWS CDK** — full infrastructure-as-code. More power and more to learn;
  better once the setup stabilizes.

---

## Cost reality

Several pieces bill by the hour regardless of traffic, so there is a floor even with zero
users:

- NAT gateway ≈ $32/mo
- Application Load Balancer ≈ $16/mo
- Small RDS instance ≈ $15–30/mo
- Fargate (one small always-on container) ≈ $15–25/mo
- S3 / CloudWatch / Route 53 ≈ a few dollars

Realistically **~$80–150/month** before a single user. App Runner can idle cheaper and
skips the NAT gateway and ALB line items.

---

## Recommendation

Do the **Part A** app changes first — they are real, reviewable code and are required no
matter which host you pick. Then, given the app is pre-launch, consider starting on **AWS
App Runner** (or Copilot-on-ECS if you specifically want ECS experience) rather than
hand-rolling the full ECS stack on day one. The container, S3, secrets, and RDS work all
carry over unchanged.
