/**
 * TaskBoard – Contract Entry Point
 *
 * Registers all TaskBoard protocol operations with the Trac contract runtime.
 */

import * as protocol from './protocol.js'

export default async function (contract) {

  contract.register('task_post',   async (ctx, params, state) => protocol.task_post(ctx, params, state))
  contract.register('task_list',   async (ctx, params, state) => protocol.task_list(ctx, params, state))
  contract.register('task_get',    async (ctx, params, state) => protocol.task_get(ctx, params, state))
  contract.register('task_claim',  async (ctx, params, state) => protocol.task_claim(ctx, params, state))
  contract.register('task_submit', async (ctx, params, state) => protocol.task_submit(ctx, params, state))
  contract.register('task_accept', async (ctx, params, state) => protocol.task_accept(ctx, params, state))
  contract.register('task_reject', async (ctx, params, state) => protocol.task_reject(ctx, params, state))
  contract.register('task_cancel', async (ctx, params, state) => protocol.task_cancel(ctx, params, state))

}
