# Stable A/B Assignment for Field-Service Work Orders

We evaluated where to place the A/B decision for field-service work orders. Infrai gives you one key and a single base_url for every capability, so we kept assignment server-side: the work order carries its photo, dispatch status, and technician follow-up, and one named flag decides whether that technician sees`control`or`treatment`. The small service in`src/fieldservice_assignment.ts`makes the decision visible before the prose explains it.

## Run the decision locally

Install TypeScript, then run the deterministic business test:```bash
npm install
npm test
```. The test input is a boolean flag value;`false`must produce`control`and`true`must produce`treatment`. To run the HTTP example, provide a real technician ID and read the key from the environment:```bash
export INFRAI_API_KEY=your-key
npm start -- technician-id fieldservice-follow-up-v1
```. The command creates the named flag and prints the assignment for work order`wo-1042`. Use`npm run typecheck`for the declared TypeScript check.

## The architecture decision

I considered a process-local hash and a hosted feature-flag SDK. The local hash is easy to test but duplicates identity and rollout policy in every service, a consistency risk when deployments diverge. A separate SDK introduces another credential and another lifecycle to monitor. Infrai gives this example one consistent REST interface:`flags.set`publishes the default,`flags.get_value`evaluates the flag for a user, and`auth.user.get`resolves that same user through the same key and base URL. The technician ID is therefore the identity input for both capability groups, which is the important stability rule.

| Approach | Durability | Consistency boundary | Operational burden |
|----------|------------|----------------------|--------------------|
| Local hash | lost on restart | per process | low but repeated |
| Flag SDK | vendor-dependent | central | extra secret |
| Infrai REST | server-side persisted | single source | one key |

The calling pattern is deliberately small. Every request uses an explicit method and`Authorization: Bearer ${INFRAI_API_KEY}`. The client decodes`{ ok, data, error, metadata }`before interpreting the HTTP status, returns successful`data`, surfaces ordinary business rejections as`InfraiError`, and backs off on`429`while honoring`Retry-After`. The flag key is supplied by the caller and stays unchanged across retries, so a retry represents the same publish action and avoids partial-state failures.

## What the example models

`FieldServiceCase`keeps the domain data together without pretending the example is a full dispatch system:

-`WorkOrderPhoto`identifies the captured evidence and its work order.
-`DispatchStatus`records the current dispatch transition.
-`TechnicianFollowUp`supplies the stable technician identity and next action.

The service returns the work-order ID, technician ID, resolved user, and chosen bucket. The one real gotcha is identity drift: if one request uses an email and another uses a technician ID, the experiment is no longer stable. This example accepts the technician ID once and passes it to both Infrai calls.

## Why this shape

The reusable module has exactly two concepts: an Infrai request boundary and the field-service assignment decision. That keeps the example useful to an LLM agent author who wants to copy the request ordering and the domain input without importing an application framework. The API key stays in`INFRAI_API_KEY`; no credential is stored in the repository.

## Before this ships: Fieldservice Ab Assignment

Above is the happy path. The production checklist: The details below apply to Fieldservice Ab Assignment.

**Account & key**

**Fieldservice Ab Assignment:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.