import { z } from "zod";
export const uid = () => crypto.randomUUID();
export const itemSchema = z.object({
  id: z.string(),
  title: z.string().max(1000),
  body: z.string().max(200000),
  richText: z.string().max(400000).default(""),
  meta: z.record(z.string().max(60), z.string().max(2000)).default({}),
  time: z.string(),
  sender: z.string(),
  avatar: z.string().default(""),
  kind: z
    .enum([
      "text",
      "image",
      "audio",
      "video",
      "file",
      "transfer",
      "call",
      "order",
      "note",
      "post",
      "event",
    ])
    .default("text"),
  media: z.string().default(""),
  hidden: z.boolean().default(false),
  unlock: z.string().default(""),
  password: z.string().default(""),
  folder: z.string().default(""),
  favorite: z.boolean().default(false),
  outgoing: z.boolean().default(false),
  read: z.boolean().default(false),
  likes: z.number().default(0),
  comments: z.array(z.string()).default([]),
});
export type Item = z.infer<typeof itemSchema>;
export const conditionSchema = z.object({
  key: z.string(),
  op: z.enum(["eq", "neq", "gt", "lt", "includes"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});
export type Condition = z.infer<typeof conditionSchema>;
export const activitySchema = z.object({
  id: z.string(),
  label: z.string().max(120),
  description: z.string().max(500).default(""),
  emoji: z.string().max(12).default("•"),
  kind: z.enum(["ordinary", "daily", "important"]).default("ordinary"),
  minutes: z.number().int().min(0).max(1440).default(0),
  locations: z.array(z.string()).default([]),
  conditions: z.array(conditionSchema).default([]),
  initiallyAvailable: z.boolean().default(true),
});
export type Activity = z.infer<typeof activitySchema>;
export const npcDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string().default(""),
  status: z.string().default("空闲"),
  availableAt: z.string().default(""),
  known: z.array(z.string()).default([]),
  closeness: z.number().default(0),
  trust: z.number().default(0),
  tension: z.number().default(0),
});
export const lifeSchema = z.object({
  initialLocation: z.string().default("未知地点"),
  activities: z.array(activitySchema).default([]),
  npcs: z.array(npcDefinitionSchema).default([]),
});
export const actionSchema = z.object({
  type: z.enum([
    "date",
    "variable",
    "unlock",
    "hide",
    "notification",
    "message",
    "time",
    "ending",
    "choice",
    "clue",
    "call",
    "location",
    "scene",
    "sceneClose",
    "relationship",
    "npcStatus",
    "knowledge",
    "activityUnlock",
    "activityLock",
    "eventStart",
    "eventEnd",
    "advanceDay",
    "advanceMinutes",
    "variableDelta",
  ]),
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});
export type Action = z.infer<typeof actionSchema>;
export const nodeSchema = z.object({
  delayMs: z.number().int().min(0).max(86400000).optional(),
  id: z.string(),
  label: z.string(),
  type: z.enum([
    "start",
    "event",
    "condition",
    "action",
    "choice",
    "delay",
    "ending",
    "comment",
  ]),
  event: z.string(),
  target: z.string(),
  conditions: z.array(conditionSchema),
  logic: z.enum(["and", "or", "not"]).default("and"),
  actions: z.array(actionSchema),
  next: z.array(z.string()),
  once: z.boolean(),
  x: z.number(),
  y: z.number(),
});
export type StoryNode = z.infer<typeof nodeSchema>;
export const workSchema = z.object({
  formatVersion: z.literal(1),
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  category: z.string(),
  cover: z.string(),
  updatedAt: z.number(),
  phone: z.object({
    owner: z.string(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    passcode: z.string().max(12),
    wallpaper: z.string(),
    theme: z.enum(["light", "dark"]),
    time: z.string(),
    battery: z.number().min(0).max(100),
    network: z.string(),
    notifications: z.boolean(),
  }),
  apps: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        installed: z.boolean().default(true),
        visible: z.boolean(),
        dock: z.boolean(),
        folder: z.string(),
        icon: z.string(),
      }),
    )
    .max(100),
  data: z.record(z.string(), z.array(itemSchema).max(20000)),
  nodes: z.array(nodeSchema).max(2000),
  variables: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ),
  life: lifeSchema.default({
    initialLocation: "未知地点",
    activities: [],
    npcs: [],
  }),
  mode: z.enum(["explore", "story", "mixed"]),
});
export type Work = z.infer<typeof workSchema>;
export type UiValue = string | number | boolean | string[];
export type Runtime = {
  date?: string;
  elapsedMs?: number;
  clockRemainderMs?: number;
  scheduled?: { nodeId: string; due: number }[];
  incomingCall?: {
    caller: string;
    target: string;
    status: "ringing" | "answered";
  } | null;
  ui?: Record<string, Record<string, UiValue>>;
  workId: string;
  revision: number;
  variables: Record<string, string | number | boolean>;
  visited: string[];
  read: string[];
  clues: string[];
  unlocked: string[];
  hidden: string[];
  completed: string[];
  notifications: string[];
  endings: string[];
  choices: { label: string; target: string }[];
  messages: Record<string, Item[]>;
  time: string;
  trace: string[];
  location: string;
  activeEvent: string | null;
  pendingEvents: string[];
  unlockedActivities: string[];
  history: {
    id: string;
    event: string;
    target: string;
    date: string;
    time: string;
    location: string;
  }[];
  relationships: Record<
    string,
    { closeness: number; trust: number; tension: number; tags: string[] }
  >;
  npcStates: Record<
    string,
    { location: string; status: string; availableAt: string; known: string[] }
  >;
  scene: {
    id: string;
    title: string;
    body: string;
    allowInput: boolean;
  } | null;
};
export function initialRuntime(w: Work): Runtime {
  return {
    date: w.phone.date,
    elapsedMs: 0,
    clockRemainderMs: 0,
    scheduled: [],
    incomingCall: null,
    ui: {},
    workId: w.id,
    revision: w.updatedAt,
    variables: { ...w.variables },
    visited: [],
    read: [],
    clues: [],
    unlocked: [],
    hidden: [],
    completed: [],
    notifications: [],
    endings: [],
    choices: [],
    messages: {},
    time: w.phone.time,
    trace: [],
    location: w.life.initialLocation,
    activeEvent: null,
    pendingEvents: [],
    unlockedActivities: w.life.activities
      .filter((a) => a.initiallyAvailable)
      .map((a) => a.id),
    history: [],
    relationships: Object.fromEntries(
      w.life.npcs.map((npc) => [
        npc.id,
        {
          closeness: npc.closeness,
          trust: npc.trust,
          tension: npc.tension,
          tags: [],
        },
      ]),
    ),
    npcStates: Object.fromEntries(
      w.life.npcs.map((npc) => [
        npc.id,
        {
          location: npc.location,
          status: npc.status,
          availableAt: npc.availableAt,
          known: [...npc.known],
        },
      ]),
    ),
    scene: null,
  };
}
export function migrateRuntime(w: Work, saved: Partial<Runtime>): Runtime {
  const fresh = initialRuntime(w);
  if (saved.workId !== w.id) return fresh;
  const itemIds = new Set(
    Object.values(w.data).flatMap((items) => items.map((i) => i.id)),
  );
  const nodeIds = new Set(w.nodes.map((node) => node.id));
  const activityIds = new Set(w.life.activities.map((activity) => activity.id));
  return {
    ...fresh,
    ...saved,
    workId: w.id,
    revision: w.updatedAt,
    variables: { ...fresh.variables, ...(saved.variables ?? {}) },
    unlocked: (saved.unlocked ?? []).filter((id) => itemIds.has(id)),
    hidden: (saved.hidden ?? []).filter((id) => itemIds.has(id)),
    completed: (saved.completed ?? []).filter((id) => nodeIds.has(id)),
    choices: (saved.choices ?? []).filter((choice) =>
      nodeIds.has(choice.target),
    ),
    scheduled: (saved.scheduled ?? []).filter((entry) =>
      nodeIds.has(entry.nodeId),
    ),
    unlockedActivities: saved.unlockedActivities
      ? saved.unlockedActivities.filter((id) => activityIds.has(id))
      : fresh.unlockedActivities,
    relationships: { ...fresh.relationships, ...(saved.relationships ?? {}) },
    npcStates: { ...fresh.npcStates, ...(saved.npcStates ?? {}) },
    history: (saved.history ?? []).slice(-200),
    scene: saved.scene ?? null,
  };
}
export function makeItem(partial: Partial<Item> = {}): Item {
  return itemSchema.parse({
    id: uid(),
    title: "新内容",
    body: "在这里写下故事…",
    time: "2026-09-01 08:30",
    sender: "小林",
    ...partial,
  });
}
export function validateWork(input: unknown): Work {
  return workSchema.parse(input);
}
export function safeMedia(value: string) {
  return /^(data:(image\/(png|jpeg|webp|gif)|audio\/(mpeg|mp3|wav|ogg|webm|mp4)|video\/(mp4|webm));base64,[a-zA-Z0-9+/=\s]+|story-images\/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp|gif))$/.test(
    value,
  ) && !value.includes("..")
    ? value
    : "";
}
