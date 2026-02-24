/**
 * TaskBoard – P2P Micro-Gig Marketplace Protocol
 *
 * Task lifecycle:
 *   open → claimed → submitted → done
 *                  ↑___reject__|
 *   open → cancelled
 *
 * Ops:
 *   task_post    – post a new task
 *   task_list    – list tasks by status
 *   task_get     – get a single task
 *   task_claim   – claim an open task
 *   task_submit  – submit work on a claimed task
 *   task_accept  – poster accepts the submission → done
 *   task_reject  – poster rejects, returns to claimed
 *   task_cancel  – poster cancels an open task
 */

const MAX_TITLE_LEN       = 100
const MAX_DESC_LEN        = 1000
const MAX_REWARD_LEN      = 100
const MAX_RESULT_LEN      = 4000
const MAX_REASON_LEN      = 500
const VALID_STATUSES      = ['open', 'claimed', 'submitted', 'done', 'cancelled', 'all']

// ------------------------------------------------------------------ //
//  Helpers
// ------------------------------------------------------------------ //

async function getTask (state, task_id) {
  const raw = await state.get(`task:${task_id}`)
  return raw ? JSON.parse(raw) : null
}

async function saveTask (state, task) {
  await state.put(`task:${task.id}`, JSON.stringify(task))
}

function getAddress (ctx) {
  return (ctx && ctx.address) ? ctx.address : 'unknown'
}

// ------------------------------------------------------------------ //
//  task_post
// ------------------------------------------------------------------ //
async function task_post (ctx, params, state) {
  const { title, description, reward = '', tags = '' } = params

  if (!title || typeof title !== 'string' || title.trim().length === 0)
    return { error: 'BAD_INPUT', message: 'title is required' }
  if (title.length > MAX_TITLE_LEN)
    return { error: 'BAD_INPUT', message: `title max ${MAX_TITLE_LEN} chars` }

  if (!description || typeof description !== 'string' || description.trim().length === 0)
    return { error: 'BAD_INPUT', message: 'description is required' }
  if (description.length > MAX_DESC_LEN)
    return { error: 'BAD_INPUT', message: `description max ${MAX_DESC_LEN} chars` }

  if (reward && reward.length > MAX_REWARD_LEN)
    return { error: 'BAD_INPUT', message: `reward max ${MAX_REWARD_LEN} chars` }

  // auto-increment id
  let counter = await state.get('task_counter')
  counter = counter ? (JSON.parse(counter) + 1) : 1
  await state.put('task_counter', JSON.stringify(counter))

  const task = {
    id:          counter,
    title:       title.trim(),
    description: description.trim(),
    reward:      reward ? reward.trim() : '',
    tags:        tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    status:      'open',
    posted_by:   getAddress(ctx),
    created_at:  Date.now(),
    claimed_by:  null,
    claimed_at:  null,
    result:      null,
    submitted_at: null,
    done_at:     null,
    reject_reason: null
  }

  await saveTask(state, task)

  return {
    ok:         true,
    task_id:    task.id,
    title:      task.title,
    posted_by:  task.posted_by,
    created_at: task.created_at
  }
}

// ------------------------------------------------------------------ //
//  task_list
// ------------------------------------------------------------------ //
async function task_list (ctx, params, state) {
  const { status = 'all' } = params

  if (!VALID_STATUSES.includes(status))
    return { error: 'BAD_INPUT', message: `status must be one of: ${VALID_STATUSES.filter(s => s !== 'all').join(', ')}, all` }

  const counterRaw = await state.get('task_counter')
  if (!counterRaw) return { tasks: [] }

  const counter = JSON.parse(counterRaw)
  const tasks = []

  for (let i = 1; i <= counter; i++) {
    const task = await getTask(state, i)
    if (!task) continue
    if (status === 'all' || task.status === status) {
      tasks.push({
        task_id:    task.id,
        title:      task.title,
        reward:     task.reward,
        tags:       task.tags,
        status:     task.status,
        posted_by:  task.posted_by,
        created_at: task.created_at,
        claimed_by: task.claimed_by
      })
    }
  }

  return { tasks }
}

// ------------------------------------------------------------------ //
//  task_get
// ------------------------------------------------------------------ //
async function task_get (ctx, params, state) {
  const { task_id } = params
  if (!task_id)
    return { error: 'BAD_INPUT', message: 'task_id is required' }

  const task = await getTask(state, task_id)
  if (!task)
    return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

  return { task }
}

// ------------------------------------------------------------------ //
//  task_claim
// ------------------------------------------------------------------ //
async function task_claim (ctx, params, state) {
  const { task_id } = params
  if (!task_id)
    return { error: 'BAD_INPUT', message: 'task_id is required' }

  const task = await getTask(state, task_id)
  if (!task)
    return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

  if (task.status !== 'open')
    return { error: task.status === 'claimed' || task.status === 'submitted'
      ? 'ALREADY_CLAIMED'
      : 'WRONG_STATUS',
      message: `task is ${task.status}` }

  const caller = getAddress(ctx)

  if (caller === task.posted_by)
    return { error: 'SELF_CLAIM', message: 'you cannot claim your own task' }

  task.status     = 'claimed'
  task.claimed_by = caller
  task.claimed_at = Date.now()

  await saveTask(state, task)

  return {
    ok:         true,
    task_id:    task.id,
    claimed_by: task.claimed_by,
    claimed_at: task.claimed_at
  }
}

// ------------------------------------------------------------------ //
//  task_submit
// ------------------------------------------------------------------ //
async function task_submit (ctx, params, state) {
  const { task_id, result } = params

  if (!task_id)
    return { error: 'BAD_INPUT', message: 'task_id is required' }
  if (!result || typeof result !== 'string' || result.trim().length === 0)
    return { error: 'BAD_INPUT', message: 'result is required' }
  if (result.length > MAX_RESULT_LEN)
    return { error: 'BAD_INPUT', message: `result max ${MAX_RESULT_LEN} chars` }

  const task = await getTask(state, task_id)
  if (!task)
    return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

  if (task.status !== 'claimed')
    return { error: 'WRONG_STATUS', message: `task must be claimed to submit; current status: ${task.status}` }

  const caller = getAddress(ctx)
  if (caller !== task.claimed_by)
    return { error: 'NOT_CLAIMANT', message: 'only the claimant can submit work' }

  task.result       = result.trim()
  task.submitted_at = Date.now()
  task.status       = 'submitted'
  task.reject_reason = null  // clear any previous rejection reason

  await saveTask(state, task)

  return {
    ok:           true,
    task_id:      task.id,
    submitted_at: task.submitted_at
  }
}

// ------------------------------------------------------------------ //
//  task_accept
// ------------------------------------------------------------------ //
async function task_accept (ctx, params, state) {
  const { task_id } = params
  if (!task_id)
    return { error: 'BAD_INPUT', message: 'task_id is required' }

  const task = await getTask(state, task_id)
  if (!task)
    return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

  const caller = getAddress(ctx)
  if (caller !== task.posted_by)
    return { error: 'NOT_POSTER', message: 'only the original poster can accept a submission' }

  if (task.status !== 'submitted')
    return { error: 'WRONG_STATUS', message: `task must be in submitted status to accept; current: ${task.status}` }

  task.status  = 'done'
  task.done_at = Date.now()

  await saveTask(state, task)

  return {
    ok:      true,
    task_id: task.id,
    done_at: task.done_at,
    worker:  task.claimed_by
  }
}

// ------------------------------------------------------------------ //
//  task_reject
// ------------------------------------------------------------------ //
async function task_reject (ctx, params, state) {
  const { task_id, reason = '' } = params
  if (!task_id)
    return { error: 'BAD_INPUT', message: 'task_id is required' }

  if (reason && reason.length > MAX_REASON_LEN)
    return { error: 'BAD_INPUT', message: `reason max ${MAX_REASON_LEN} chars` }

  const task = await getTask(state, task_id)
  if (!task)
    return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

  const caller = getAddress(ctx)
  if (caller !== task.posted_by)
    return { error: 'NOT_POSTER', message: 'only the original poster can reject a submission' }

  if (task.status !== 'submitted')
    return { error: 'WRONG_STATUS', message: `task must be in submitted status to reject; current: ${task.status}` }

  task.status        = 'claimed'   // worker can resubmit
  task.reject_reason = reason ? reason.trim() : null

  await saveTask(state, task)

  return {
    ok:      true,
    task_id: task.id,
    reason:  task.reject_reason,
    status:  'claimed'
  }
}

// ------------------------------------------------------------------ //
//  task_cancel
// ------------------------------------------------------------------ //
async function task_cancel (ctx, params, state) {
  const { task_id } = params
  if (!task_id)
    return { error: 'BAD_INPUT', message: 'task_id is required' }

  const task = await getTask(state, task_id)
  if (!task)
    return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

  const caller = getAddress(ctx)
  if (caller !== task.posted_by)
    return { error: 'NOT_POSTER', message: 'only the original poster can cancel a task' }

  if (task.status !== 'open')
    return { error: 'WRONG_STATUS', message: `only open tasks can be cancelled; current: ${task.status}` }

  task.status = 'cancelled'

  await saveTask(state, task)

  return {
    ok:      true,
    task_id: task.id,
    status:  'cancelled'
  }
}

// ------------------------------------------------------------------ //
//  Exports
// ------------------------------------------------------------------ //
export {
  task_post,
  task_list,
  task_get,
  task_claim,
  task_submit,
  task_accept,
  task_reject,
  task_cancel
}
