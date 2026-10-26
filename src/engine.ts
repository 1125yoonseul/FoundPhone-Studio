import type {
  Action,
  Activity,
  Condition,
  Runtime,
  StoryNode,
  Work,
} from "./schema";
import { makeItem } from "./schema";
export function testCondition(c: Condition, s: Runtime): boolean {
  const [scope, ...rest] = c.key.split(":");
  const key = rest.join(":");
  const lists: Record<string, string[]> = {
    visited: s.visited,
    read: s.read,
    clue: s.clues,
    unlocked: s.unlocked,
    completed: s.completed,
  };
  const actual =
    c.key === "location"
      ? s.location
      : c.key === "date"
        ? s.date
        : c.key === "time"
          ? s.time
          : scope === "relationship"
            ? s.relationships?.[rest[0]]?.[
                rest[1] as "closeness" | "trust" | "tension"
              ]
            : scope === "npc"
              ? rest[1] === "known"
                ? s.npcStates?.[rest[0]]?.known.join("|")
                : s.npcStates?.[rest[0]]?.[
                    rest[1] as "location" | "status" | "availableAt"
                  ]
              : scope === "pending"
                ? s.pendingEvents.includes(key)
                : scope === "activity"
                  ? s.unlockedActivities.includes(key)
                  : scope === "ui"
                    ? s.ui?.[rest[0]]?.[rest.slice(1).join(":")]
                    : lists[scope]
                      ? lists[scope].includes(key)
                      : s.variables[c.key];
  switch (c.op) {
    case "eq":
      return actual === c.value;
    case "neq":
      return actual !== c.value;
    case "gt":
      return typeof actual === "number" && actual > Number(c.value);
    case "lt":
      return typeof actual === "number" && actual < Number(c.value);
    case "includes":
      return String(actual ?? "").includes(String(c.value));
  }
}
function apply(a: Action, s: Runtime, w: Work) {
  switch (a.type) {
    case "date":
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(a.value))) s.date = String(a.value);
      break;
    case "variable":
      s.variables[a.key] = a.value;
      break;
    case "unlock":
      if (!s.unlocked.includes(a.key)) s.unlocked.push(a.key);
      s.hidden = s.hidden.filter((id) => id !== a.key);
      break;
    case "hide":
      if (!s.hidden.includes(a.key)) s.hidden.push(a.key);
      break;
    case "notification":
      s.notifications.push(String(a.value));
      break;
    case "call":
      s.notifications.push(`${String(a.value)} 来电`);
      s.incomingCall = {
        caller: String(a.value),
        target: a.key,
        status: "ringing",
      };
      break;
    case "clue":
      if (!s.clues.includes(a.key)) s.clues.push(a.key);
      break;
    case "time":
      s.time = String(a.value);
      s.clockRemainderMs = 0;
      break;
    case "ending":
      if (!s.endings.includes(String(a.value))) s.endings.push(String(a.value));
      break;
    case "choice":
      if (!s.choices.some((c) => c.target === a.key))
        s.choices.push({ label: String(a.value), target: a.key });
      break;
    case "message":
      {
        const [app, thread = "新消息", direction = "outgoing"] =
          a.key.split("|");
        const outgoing = direction !== "incoming";
        s.messages[app] = [
          ...(s.messages[app] ?? []),
          makeItem({
            id: `event-${app}-${s.completed.length}-${s.messages[app]?.length ?? 0}`,
            title: thread,
            sender: outgoing ? w.phone.owner : thread,
            body: String(a.value),
            time: `${s.date || w.phone.date} ${s.time || w.phone.time}`,
            outgoing,
            read: outgoing,
          }),
        ];
      }
      break;
    case "location":
      s.location = String(a.value);
      break;
    case "scene": {
      const [id, title = "线下事件", input = "true"] = a.key.split("|");
      s.scene = {
        id,
        title,
        body: String(a.value),
        allowInput: input !== "false",
      };
      break;
    }
    case "sceneClose":
      s.scene = null;
      break;
    case "relationship": {
      const [npc, field = "closeness"] = a.key.split(".");
      const relation = (s.relationships[npc] ??= {
        closeness: 0,
        trust: 0,
        tension: 0,
        tags: [],
      });
      if (["closeness", "trust", "tension"].includes(field))
        relation[field as "closeness" | "trust" | "tension"] += Number(a.value);
      else if (field === "tag" && !relation.tags.includes(String(a.value)))
        relation.tags.push(String(a.value));
      break;
    }
    case "npcStatus": {
      const [npc, field = "status"] = a.key.split(".");
      const state = (s.npcStates[npc] ??= {
        location: "",
        status: "",
        availableAt: "",
        known: [],
      });
      if (["location", "status", "availableAt"].includes(field))
        state[field as "location" | "status" | "availableAt"] = String(a.value);
      break;
    }
    case "knowledge": {
      const state = (s.npcStates[a.key] ??= {
        location: "",
        status: "",
        availableAt: "",
        known: [],
      });
      if (!state.known.includes(String(a.value)))
        state.known.push(String(a.value));
      break;
    }
    case "activityUnlock":
      if (!s.unlockedActivities.includes(a.key))
        s.unlockedActivities.push(a.key);
      break;
    case "activityLock":
      s.unlockedActivities = s.unlockedActivities.filter((id) => id !== a.key);
      break;
    case "eventStart":
      s.activeEvent = a.key;
      s.pendingEvents = s.pendingEvents.filter((id) => id !== a.key);
      break;
    case "eventEnd":
      if (s.activeEvent === a.key || !a.key) s.activeEvent = null;
      if (a.value && !s.pendingEvents.includes(String(a.value)))
        s.pendingEvents.push(String(a.value));
      break;
  }
}
function runQueue(
  w: Work,
  s: Runtime,
  event: string,
  target: string,
  queue: string[],
  resuming = new Set<string>(),
) {
  const seen = new Set<string>();
  let steps = 0;
  while (queue.length && steps++ < 200) {
    const id = queue.shift()!;
    const n = w.nodes.find((n) => n.id === id);
    if (!n || seen.has(id) || (n.once && s.completed.includes(id))) continue;
    seen.add(id);
    const conditions = n.conditions.map((c) => testCondition(c, s));
    const pass =
      n.logic === "or"
        ? conditions.some(Boolean)
        : n.logic === "not"
          ? !conditions.every(Boolean)
          : conditions.every(Boolean);
    if (!pass) continue;
    if (n.type === "delay" && !resuming.has(id)) {
      s.scheduled ??= [];
      if (!s.scheduled.some((t) => t.nodeId === id))
        s.scheduled.push({
          nodeId: id,
          due: (s.elapsedMs ?? 0) + (n.delayMs ?? 1000),
        });
      s.trace.push(`delay:${n.delayMs ?? 1000}ms → ${n.label}`);
      continue;
    }
    if (!s.completed.includes(id)) s.completed.push(id);
    s.trace.push(`${event}:${target} → ${n.label}`);
    for (const a of n.actions) {
      const previous =
        a.type === "variable"
          ? s.variables[a.key]
          : a.type === "time"
            ? s.time
            : a.type === "location"
              ? s.location
              : undefined;
      apply(a, s, w);
      if (a.type === "variable" && previous !== s.variables[a.key])
        queue.push(
          ...w.nodes
            .filter(
              (n) =>
                n.event === "variable" && (!n.target || n.target === a.key),
            )
            .map((n) => n.id),
        );
      if (a.type === "time" && previous !== s.time)
        queue.push(
          ...w.nodes
            .filter(
              (n) => n.event === "time" && (!n.target || n.target === s.time),
            )
            .map((n) => n.id),
        );
      if (a.type === "location" && previous !== s.location)
        queue.push(
          ...w.nodes
            .filter(
              (n) =>
                n.event === "location" &&
                (!n.target || n.target === s.location),
            )
            .map((n) => n.id),
        );
    }
    if (
      n.type === "ending" &&
      !n.actions.some((a) => a.type === "ending") &&
      !s.endings.includes(n.label)
    )
      s.endings.push(n.label);
    if (n.type === "choice") {
      for (const id of n.next)
        if (!s.choices.some((c) => c.target === id))
          s.choices.push({
            label: w.nodes.find((n) => n.id === id)?.label ?? id,
            target: id,
          });
    } else queue.push(...n.next);
  }
  s.trace = s.trace.slice(-100);
  return s;
}
export function dispatch(
  w: Work,
  previous: Runtime,
  event: string,
  target = "",
): Runtime {
  const s = structuredClone(previous);
  if (event === "choose" || event === "sceneInput") s.choices = [];
  if (event === "openApp" && !s.visited.includes(target))
    s.visited.push(target);
  if (event === "read" && !s.read.includes(target)) s.read.push(target);
  if (
    ["action", "choose", "sceneInput", "callAnswered", "callDeclined"].includes(
      event,
    )
  )
    s.history.push({
      id: `${event}-${s.history.length + 1}`,
      event,
      target,
      date: s.date ?? w.phone.date ?? "",
      time: s.time,
      location: s.location,
    });
  s.history = s.history.slice(-200);
  if (w.mode === "explore") return s;
  const queue = w.nodes
    .filter(
      (n) =>
        (n.type === "start" && event === "start") ||
        (n.event === event && (!n.target || n.target === target)),
    )
    .map((n) => n.id);
  return runQueue(w, s, event, target, queue);
}

export function availableActivities(w: Work, s: Runtime): Activity[] {
  return w.life.activities.filter(
    (activity) =>
      s.unlockedActivities.includes(activity.id) &&
      (!activity.locations.length || activity.locations.includes(s.location)) &&
      activity.conditions.every((condition) => testCondition(condition, s)),
  );
}

export function performActivity(w: Work, s: Runtime, activity: Activity) {
  if (
    !availableActivities(w, s).some((candidate) => candidate.id === activity.id)
  )
    return s;
  return advance(
    w,
    dispatch(w, s, "action", activity.id),
    activity.minutes * 60_000,
  );
}

export function classifySceneIntent(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) return "empty";
  if (/回家|离开|结束|先走|不待/.test(text)) return "leave";
  if (/散步|走走|继续走|江边/.test(text)) return "walk";
  if (/饮料|拿走|草莓牛奶|给我/.test(text)) return "drink";
  if (/为什么|怎么|突然|来这里/.test(text)) return "ask";
  if (/不回|沉默|没说|摇头/.test(text)) return "quiet";
  return "other";
}

export function classifyChatIntent(value: string) {
  const text = value.trim().toLowerCase();
  if (/过去|去找|去江边|马上来|等我/.test(text)) return "meet";
  if (/等会|晚点|现在不|先不|不想回/.test(text)) return "later";
  if (/为什么|说清楚|什么意思|你想说什么/.test(text)) return "ask";
  return "other";
}
export function advance(
  w: Work,
  previous: Runtime,
  milliseconds: number,
): Runtime {
  const s = structuredClone(previous);
  const delta = Number.isFinite(milliseconds)
    ? Math.max(0, Math.min(milliseconds, 86400000))
    : 0;
  const end = (s.elapsedMs ?? 0) + delta;
  s.elapsedMs ??= 0;
  s.clockRemainderMs ??= 0;
  s.scheduled ??= [];
  let resumes = 0;
  while (true) {
    s.scheduled.sort((a, b) => a.due - b.due);
    const due =
      w.mode !== "explore" && resumes < 200 ? s.scheduled[0] : undefined;
    const clockAt = s.elapsedMs + 60000 - s.clockRemainderMs;
    const next = Math.min(
      end,
      clockAt,
      due ? Math.max(s.elapsedMs, due.due) : Infinity,
    );
    s.clockRemainderMs += next - s.elapsedMs;
    s.elapsedMs = next;
    if (s.clockRemainderMs >= 60000) {
      s.clockRemainderMs -= 60000;
      const match = s.time.match(/^(\d{1,2}):(\d{2})$/);
      if (match) {
        const value = (Number(match[1]) * 60 + Number(match[2]) + 1) % 1440;
        s.time =
          String(Math.floor(value / 60)).padStart(2, "0") +
          ":" +
          String(value % 60).padStart(2, "0");
        if (w.mode !== "explore")
          runQueue(
            w,
            s,
            "time",
            s.time,
            w.nodes
              .filter(
                (n) => n.event === "time" && (!n.target || n.target === s.time),
              )
              .map((n) => n.id),
          );
      }
    }
    if (due && due.due <= s.elapsedMs) {
      s.scheduled.splice(s.scheduled.indexOf(due), 1);
      resumes++;
      runQueue(w, s, "timer", due.nodeId, [due.nodeId], new Set([due.nodeId]));
      continue;
    }
    if (s.elapsedMs >= end) break;
  }
  return s;
}
export function choose(w: Work, s: Runtime, id: string) {
  const node = w.nodes.find((n) => n.id === id);
  if (!node || !s.choices.some((c) => c.target === id)) return s;
  return dispatch(
    {
      ...w,
      nodes: w.nodes.map((n) =>
        n.id === id ? { ...n, event: "choose", target: id } : n,
      ),
    },
    s,
    "choose",
    id,
  );
}
export function validateGraph(nodes: StoryNode[]) {
  const errors: string[] = [];
  for (const n of nodes) {
    for (const id of n.next)
      if (!nodes.some((x) => x.id === id))
        errors.push(`${n.label} 引用了不存在的节点 ${id}`);
    if (n.next.includes(n.id))
      errors.push(`${n.label} 存在自环（运行时会阻止循环）`);
  }
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    nodes.find((n) => n.id === id)?.next.forEach(visit);
  };
  nodes
    .filter((n) => n.type === "start" || n.event)
    .forEach((n) => visit(n.id));
  nodes
    .filter((n) => n.type !== "comment" && !reachable.has(n.id))
    .forEach((n) => errors.push(`${n.label} 不可达`));
  return errors;
}
export function visible(
  item: { id: string; hidden: boolean; unlock: string },
  s: Runtime,
) {
  return (
    !s.hidden.includes(item.id) &&
    (!item.hidden || s.unlocked.includes(item.id)) &&
    (!item.unlock ||
      testCondition({ key: item.unlock, op: "eq", value: true }, s))
  );
}
