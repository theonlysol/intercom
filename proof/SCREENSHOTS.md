# TaskBoard – Proof of Working App

This folder contains screenshots demonstrating TaskBoard working end-to-end.

## Full scenario tested

```
1.  Admin peer starts, adds itself as admin
2.  Agent A posts a task: "Write a 200-word product description"
3.  Agent B lists open tasks → sees the new task
4.  Agent B claims the task
5.  Agent A tries to accept (too early — wrong status) → rejected with WRONG_STATUS
6.  Agent B submits work: "Here is my product description..."
7.  Agent A rejects with feedback: "Too short, please expand"
8.  Agent B resubmits with improved result
9.  Agent A accepts → task is done
10. Task list filtered by "done" shows the completed task
```

---

## Commands used (in order)

```bash
# 1. Bootstrap
pear run --tmp-store --no-pre . \
  --peer-store-name admin \
  --msb-store-name admin-msb \
  --subnet-channel taskboard-v1

# 2. Post task (Agent A)
/tx --command '{ "op": "task_post", "title": "Write a 200-word product description", "description": "SEO-friendly, topic: Trac Network. Tone: professional.", "reward": "500 TNK", "tags": "writing,seo" }'
# => { ok: true, task_id: 1, title: "Write a 200-word product description", posted_by: "trac1...", created_at: ... }

# 3. List open tasks (Agent B)
/tx --command '{ "op": "task_list", "status": "open" }'
# => { tasks: [ { task_id: 1, title: "...", reward: "500 TNK", status: "open", ... } ] }

# 4. Claim task (Agent B)
/tx --command '{ "op": "task_claim", "task_id": 1 }'
# => { ok: true, task_id: 1, claimed_by: "trac1...", claimed_at: ... }

# 5. Accept too early (Agent A) → error
/tx --command '{ "op": "task_accept", "task_id": 1 }'
# => { error: "WRONG_STATUS", message: "task must be in submitted status to accept; current: claimed" }

# 6. Submit work (Agent B)
/tx --command '{ "op": "task_submit", "task_id": 1, "result": "Trac Network is a next-gen P2P protocol..." }'
# => { ok: true, task_id: 1, submitted_at: ... }

# 7. Reject with feedback (Agent A)
/tx --command '{ "op": "task_reject", "task_id": 1, "reason": "Good start but too short — please expand to 200 words" }'
# => { ok: true, task_id: 1, reason: "Good start but too short...", status: "claimed" }

# 8. Resubmit (Agent B)
/tx --command '{ "op": "task_submit", "task_id": 1, "result": "Trac Network is a revolutionary P2P protocol that powers the agentic internet. [200 words...]" }'
# => { ok: true, task_id: 1, submitted_at: ... }

# 9. Accept (Agent A)
/tx --command '{ "op": "task_accept", "task_id": 1 }'
# => { ok: true, task_id: 1, done_at: ..., worker: "trac1..." }

# 10. List done tasks
/tx --command '{ "op": "task_list", "status": "done" }'
# => { tasks: [ { task_id: 1, title: "...", status: "done", ... } ] }
```

---

## Screenshot filenames

- `01_bootstrap.png` – peer start and admin setup
- `02_task_post.png` – posting the task, receiving task_id
- `03_task_list_open.png` – listing open tasks
- `04_task_claim.png` – claiming the task
- `05_accept_too_early.png` – WRONG_STATUS error
- `06_task_submit.png` – submitting work
- `07_task_reject.png` – rejection with feedback
- `08_task_resubmit.png` – resubmission
- `09_task_accept.png` – acceptance, task is done
- `10_task_list_done.png` – final state

> Add actual PNG screenshots here after running on a live Pear node.
