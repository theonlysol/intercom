import { Contract } from 'trac-peer'

class TaskBoardContract extends Contract {

  constructor (protocol, config) {
    super(protocol, config)

    // Register all functions
    this.addFunction('task_post')
    this.addFunction('task_list')
    this.addFunction('task_get')
    this.addFunction('task_claim')
    this.addFunction('task_submit')
    this.addFunction('task_accept')
    this.addFunction('task_reject')
    this.addFunction('task_cancel')
  }

  async task_post () {
    const params = this.op.value
    const { title, description, reward = '', tags = '' } = params

    if (!title || typeof title !== 'string' || title.trim().length === 0)
      return { error: 'BAD_INPUT', message: 'title is required' }
    if (title.length > 100)
      return { error: 'BAD_INPUT', message: 'title max 100 chars' }
    if (!description || typeof description !== 'string' || description.trim().length === 0)
      return { error: 'BAD_INPUT', message: 'description is required' }
    if (description.length > 1000)
      return { error: 'BAD_INPUT', message: 'description max 1000 chars' }

    let counter = await this.get('task_counter')
    counter = counter ? (JSON.parse(counter) + 1) : 1
    await this.put('task_counter', JSON.stringify(counter))

    const task = {
      id:            counter,
      title:         title.trim(),
      description:   description.trim(),
      reward:        reward ? String(reward).trim() : '',
      tags:          tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : [],
      status:        'open',
      posted_by:     this.address,
      created_at:    Date.now(),
      claimed_by:    null,
      claimed_at:    null,
      result:        null,
      submitted_at:  null,
      done_at:       null,
      reject_reason: null
    }

    await this.put(`task:${counter}`, JSON.stringify(task))

    return { ok: true, task_id: task.id, title: task.title, posted_by: task.posted_by }
  }

  async task_list () {
    const params = this.op.value
    const status = params.status || 'all'
    const valid = ['open', 'claimed', 'submitted', 'done', 'cancelled', 'all']

    if (!valid.includes(status))
      return { error: 'BAD_INPUT', message: `status must be one of: ${valid.join(', ')}` }

    const counterRaw = await this.get('task_counter')
    if (!counterRaw) return { tasks: [] }

    const counter = JSON.parse(counterRaw)
    const tasks = []

    for (let i = 1; i <= counter; i++) {
      const raw = await this.get(`task:${i}`)
      if (!raw) continue
      const task = JSON.parse(raw)
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

  async task_get () {
    const { task_id } = this.op.value
    if (!task_id) return { error: 'BAD_INPUT', message: 'task_id is required' }

    const raw = await this.get(`task:${task_id}`)
    if (!raw) return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

    return { task: JSON.parse(raw) }
  }

  async task_claim () {
    const { task_id } = this.op.value
    if (!task_id) return { error: 'BAD_INPUT', message: 'task_id is required' }

    const raw = await this.get(`task:${task_id}`)
    if (!raw) return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

    const task = JSON.parse(raw)

    if (task.status !== 'open')
      return {
        error: (task.status === 'claimed' || task.status === 'submitted') ? 'ALREADY_CLAIMED' : 'WRONG_STATUS',
        message: `task is ${task.status}`
      }

    if (this.address === task.posted_by)
      return { error: 'SELF_CLAIM', message: 'you cannot claim your own task' }

    task.status     = 'claimed'
    task.claimed_by = this.address
    task.claimed_at = Date.now()

    await this.put(`task:${task_id}`, JSON.stringify(task))

    return { ok: true, task_id: task.id, claimed_by: task.claimed_by }
  }

  async task_submit () {
    const { task_id, result } = this.op.value

    if (!task_id) return { error: 'BAD_INPUT', message: 'task_id is required' }
    if (!result || typeof result !== 'string' || result.trim().length === 0)
      return { error: 'BAD_INPUT', message: 'result is required' }
    if (result.length > 4000) return { error: 'BAD_INPUT', message: 'result max 4000 chars' }

    const raw = await this.get(`task:${task_id}`)
    if (!raw) return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

    const task = JSON.parse(raw)

    if (task.status !== 'claimed')
      return { error: 'WRONG_STATUS', message: `task must be claimed to submit; current: ${task.status}` }
    if (this.address !== task.claimed_by)
      return { error: 'NOT_CLAIMANT', message: 'only the claimant can submit work' }

    task.result        = result.trim()
    task.submitted_at  = Date.now()
    task.status        = 'submitted'
    task.reject_reason = null

    await this.put(`task:${task_id}`, JSON.stringify(task))

    return { ok: true, task_id: task.id, submitted_at: task.submitted_at }
  }

  async task_accept () {
    const { task_id } = this.op.value
    if (!task_id) return { error: 'BAD_INPUT', message: 'task_id is required' }

    const raw = await this.get(`task:${task_id}`)
    if (!raw) return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

    const task = JSON.parse(raw)

    if (this.address !== task.posted_by)
      return { error: 'NOT_POSTER', message: 'only the original poster can accept' }
    if (task.status !== 'submitted')
      return { error: 'WRONG_STATUS', message: `task must be submitted to accept; current: ${task.status}` }

    task.status  = 'done'
    task.done_at = Date.now()

    await this.put(`task:${task_id}`, JSON.stringify(task))

    return { ok: true, task_id: task.id, done_at: task.done_at, worker: task.claimed_by }
  }

  async task_reject () {
    const { task_id, reason = '' } = this.op.value
    if (!task_id) return { error: 'BAD_INPUT', message: 'task_id is required' }

    const raw = await this.get(`task:${task_id}`)
    if (!raw) return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

    const task = JSON.parse(raw)

    if (this.address !== task.posted_by)
      return { error: 'NOT_POSTER', message: 'only the original poster can reject' }
    if (task.status !== 'submitted')
      return { error: 'WRONG_STATUS', message: `task must be submitted to reject; current: ${task.status}` }

    task.status        = 'claimed'
    task.reject_reason = reason ? String(reason).trim() : null

    await this.put(`task:${task_id}`, JSON.stringify(task))

    return { ok: true, task_id: task.id, reason: task.reject_reason, status: 'claimed' }
  }

  async task_cancel () {
    const { task_id } = this.op.value
    if (!task_id) return { error: 'BAD_INPUT', message: 'task_id is required' }

    const raw = await this.get(`task:${task_id}`)
    if (!raw) return { error: 'TASK_NOT_FOUND', message: `no task with id ${task_id}` }

    const task = JSON.parse(raw)

    if (this.address !== task.posted_by)
      return { error: 'NOT_POSTER', message: 'only the original poster can cancel' }
    if (task.status !== 'open')
      return { error: 'WRONG_STATUS', message: `only open tasks can be cancelled; current: ${task.status}` }

    task.status = 'cancelled'

    await this.put(`task:${task_id}`, JSON.stringify(task))

    return { ok: true, task_id: task.id, status: 'cancelled' }
  }

}

export { TaskBoardContract }
export default TaskBoardContract