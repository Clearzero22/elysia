// src/db/prisma-middleware.ts

import type { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { getCacheInvalidator } from '../services/rbac/cache-invalidator'

type PrismaMiddleware = Parameters<PrismaClient['$use']>[0]

/**
 * RBAC 相关的模型名称
 */
const RBAC_MODELS = [
  'UserRole',
  'RolePermission',
  'Role',
  'Permission',
  'UserScope',
  'ScopePolicy',
  'OwnershipPolicy'
] as const

/**
 * 需要触发缓存失效的操作
 */
const WRITE_OPERATIONS = ['create', 'update', 'delete', 'upsert'] as const

/**
 * RBAC 缓存失效 Prisma 中间件
 *
 * 自动监听数据库变更并触发缓存失效
 *
 * @example
 * ```typescript
 * // src/db/prisma.ts
 * import { PrismaClient } from '@prisma/client'
 * import { rbacCacheMiddleware } from './prisma-middleware'
 *
 * const prisma = new PrismaClient()
 * prisma.$use(rbacCacheMiddleware)
 * ```
 */
export const rbacCacheMiddleware: PrismaMiddleware = async (
  params,
  next
) => {
  // 执行原始操作
  const result = await next(params)

  // 检查是否需要触发缓存失效
  if (shouldInvalidateCache(params)) {
    // 异步触发缓存失效（不阻塞请求）
    invalidateCacheAsync(params, result).catch(error => {
      console.error('Cache invalidation failed:', error)
    })
  }

  return result
}

/**
 * 判断是否需要触发缓存失效
 */
function shouldInvalidateCache(params: Prisma.MiddlewareParams): boolean {
  const { model, action } = params

  // 只处理 RBAC 相关模型
  if (!model || !RBAC_MODELS.includes(model as any)) {
    return false
  }

  // 只处理写操作
  return WRITE_OPERATIONS.includes(action as any)
}

/**
 * 异步触发缓存失效
 */
async function invalidateCacheAsync(
  params: Prisma.MiddlewareParams,
  result: any
): Promise<void> {
  try {
    const invalidator = getCacheInvalidator()
    const { model, action, args } = params

    switch (model) {
      case 'UserRole':
        await handleUserRoleChange(invalidator, action, args, result)
        break

      case 'RolePermission':
        await handleRolePermissionChange(invalidator, action, args, result)
        break

      case 'Role':
        await handleRoleChange(invalidator, action, args, result)
        break

      case 'UserScope':
        await handleUserScopeChange(invalidator, action, args, result)
        break

      case 'ScopePolicy':
        await invalidator.onScopePolicyChanged()
        break

      case 'OwnershipPolicy':
        await invalidator.onOwnershipPolicyChanged()
        break
    }
  } catch (error) {
    // 初始化失败时忽略（可能在服务初始化之前）
    if ((error as Error).message?.includes('not initialized')) {
      return
    }
    throw error
  }
}

/**
 * 处理 UserRole 变更
 */
async function handleUserRoleChange(
  invalidator: ReturnType<typeof getCacheInvalidator>,
  action: string,
  args: any,
  result: any
): Promise<void> {
  if (action === 'create') {
    const userId = args.data?.userId || result?.userId
    const roleId = args.data?.roleId || result?.roleId
    if (userId && roleId) {
      await invalidator.onUserRoleAdded(userId, roleId)
    }
  } else if (action === 'delete') {
    const userId = args.where?.userId || result?.userId
    const roleId = args.where?.roleId || result?.roleId
    if (userId && roleId) {
      await invalidator.onUserRoleRemoved(userId, roleId)
    }
  } else if (action === 'deleteMany') {
    // 批量删除需要重新加载用户权限
    if (args.where?.userId) {
      await invalidator.invalidateUserPermission(args.where.userId)
    } else if (args.where?.roleId) {
      await invalidator.invalidateRoleUsers(args.where.roleId)
    }
  }
}

/**
 * 处理 RolePermission 变更
 */
async function handleRolePermissionChange(
  invalidator: ReturnType<typeof getCacheInvalidator>,
  action: string,
  args: any,
  result: any
): Promise<void> {
  const roleId = args.where?.roleId || args.data?.roleId || result?.roleId
  if (roleId) {
    await invalidator.onRolePermissionChanged(roleId)
  }
}

/**
 * 处理 Role 变更
 */
async function handleRoleChange(
  invalidator: ReturnType<typeof getCacheInvalidator>,
  action: string,
  args: any,
  result: any
): Promise<void> {
  if (action === 'delete') {
    const roleId = args.where?.id || result?.id
    if (roleId) {
      await invalidator.onRoleDeleted(roleId)
    }
  } else if (action === 'update') {
    // 角色更新可能影响继承关系
    const roleId = args.where?.id
    if (roleId) {
      await invalidator.onRolePermissionChanged(roleId)
    }
  }
}

/**
 * 处理 UserScope 变更
 */
async function handleUserScopeChange(
  invalidator: ReturnType<typeof getCacheInvalidator>,
  action: string,
  args: any,
  result: any
): Promise<void> {
  const userId = args.where?.userId || args.data?.userId || result?.userId
  if (userId) {
    await invalidator.onUserScopesChanged(userId)
  }
}

/**
 * 创建带有 RBAC 中间件的 Prisma 客户端
 */
export function createPrismaWithRbacMiddleware(
  PrismaClientClass: typeof PrismaClient
): PrismaClient {
  const prisma = new PrismaClientClass()
  prisma.$use(rbacCacheMiddleware)
  return prisma
}
