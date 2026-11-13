import { InfraiClient, infrai } from "./infrai.ts";

export type WorkOrderPhoto = { id: string; workOrderId: string; uri: string; capturedAt: string };
export type DispatchStatus = "queued" | "dispatched" | "complete";
export type TechnicianFollowUp = { technicianId: string; note: string; dueAt: string };
export type FieldServiceCase = { workOrderId: string; photo: WorkOrderPhoto; status: DispatchStatus; followUp: TechnicianFollowUp };

export function chooseAssignment(flagValue: boolean): "control" | "treatment" {
  return flagValue ? "treatment" : "control";
}

export async function assignCase(client: InfraiClient, input: FieldServiceCase, flagKey: string) {
  const user = await infrai.auth.user.get(client, input.followUp.technicianId);
  const bucket = await infrai.flags.get_value(client, flagKey, input.followUp.technicianId);
  return { workOrderId: input.workOrderId, technicianId: input.followUp.technicianId, user, bucket: chooseAssignment(bucket.value) };
}

export async function prepareExperiment(client: InfraiClient, flagKey: string): Promise<void> {
  await infrai.flags.set(client, { key: flagKey, type: "bool", default_value: false, enabled: true });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const technicianId = process.argv[2];
  if (!technicianId) throw new Error("Usage: npm start -- technician-id [flag-key]");
  const flagKey = process.argv[3] ?? "fieldservice-follow-up-v1";
  const client = new InfraiClient();
  await prepareExperiment(client, flagKey);
  const result = await assignCase(client, {
    workOrderId: "wo-1042",
    photo: { id: "photo-1042", workOrderId: "wo-1042", uri: "https://example.invalid/wo-1042.jpg", capturedAt: "2026-10-24T09:00:00Z" },
    status: "dispatched",
    followUp: { technicianId, note: "Confirm panel replacement", dueAt: "2026-10-25T09:00:00Z" }
  }, flagKey);
  console.log(JSON.stringify(result, null, 2));
}
