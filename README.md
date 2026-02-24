# TaskBoard – P2P Micro-Gig Marketplace on Trac Network

TaskBoard is a decentralized task marketplace built on Intercom / Trac Network.  
Any peer can post a task with a description and optional TNK reward. Other peers can claim it, submit their work, and have it accepted or rejected — all tracked on-chain with a verifiable, tamper-proof record.

**Use cases**
- Agents delegating work to other agents for TNK
- Community microjobs (translations, reviews, bug reports, design feedback)
- DAO task bounties with structured acceptance flow
- Human-to-agent task assignment with on-chain proof of completion

---

## Trac Address (for payouts)

trac1gkx7kqfww9hr6648szufv3tfnj2u58jnl2al4jz7fqy2086lkzzqlq7mg8

---

## Proof

See [`proof/`](./proof/) for screenshots showing tasks being posted, claimed, submitted, and accepted.

---

## Competition Links

- This fork: https://github.com/theonlysol/intercom
- Main repo: https://github.com/Trac-Systems/intercom
- Awesome Intercom: https://github.com/Trac-Systems/awesome-intercom

---

## Quick Start

Use the **Pear runtime only** (never native node).

```bash
git clone https://github.com/theonlysol/intercom
cd intercom
npm install
npm pkg set overrides.trac-wallet=1.0.1
rm -rf node_modules package-lock.json
npm install
pear run --tmp-store --no-pre . --peer-store-name admin --msb-store-name admin-msb --subnet-channel taskboard-v1
```

On first run, type `/exit`, then re-run.  
When the options prompt appears, add yourself as admin:

```
/add_admin --address <YourPeerAddress>
```

---

## Commands

### Post a task

```
/tx --command '{ "op": "task_post", "title": "Write a 200-word product description", "description": "Needs to be SEO-friendly, topic: Trac Network", "reward": "500 TNK", "tags": "writing,seo" }'
```

Returns a `task_id`.

### List tasks

```
/tx --command '{ "op": "task_list", "status": "open" }'
```

Valid statuses: `open`, `claimed`, `submitted`, `done`, `cancelled`, `all`.

### Get a task

```
/tx --command '{ "op": "task_get", "task_id": 1 }'
```

### Claim a task

```
/tx --command '{ "op": "task_claim", "task_id": 1 }'
```

One claim per task. First come, first served.

### Submit work

```
/tx --command '{ "op": "task_submit", "task_id": 1, "result": "Here is the completed product description: ..." }'
```

Only the claimant can submit.

### Accept submission (poster only)

```
/tx --command '{ "op": "task_accept", "task_id": 1 }'
```

Marks the task as `done`.

### Reject submission (poster only)

```
/tx --command '{ "op": "task_reject", "task_id": 1, "reason": "Too short, please expand the second paragraph" }'
```

Returns task to `claimed` status so the worker can resubmit.

### Cancel a task (poster only, while open)

```
/tx --command '{ "op": "task_cancel", "task_id": 1 }'
```

---

## Notes

- Full setup and operational details are in `SKILL.md`.
- Only the original poster can accept, reject, or cancel a task.
- Only the claimant can submit work.
- Tasks can be resubmitted after rejection.
- `reward` is a free-text field — actual TNK transfer is handled externally via MSB.
