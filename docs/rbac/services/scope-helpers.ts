// src/services/rbac/scope-helpers.ts

import type { Prisma } from '@prisma/client'
import { getScopeResolver } from './scope-resolver'
import { getPermissionService } from './permission-service'
import type { PermissionCheck, UserPermissionContext } from './types'

/**
 * 权限检查 + Scope 应用结果
 */
export interface PermissionWithScopeResult {
  allowed: boolean
  reason?: string
  /**
   * 应用到 Prisma 查询的 where 条件
   * 如果为 null，表示没有 Scope 限制
   */
  whereCondition: Record<string, unknown> | null
}

/**
 * 检查权限并解析 Scope 条件
 *
 * @example
 * ```typescript
 * const result = await checkPermissionWithScope(user.id, {
 *   resource: 'project',
 *   action: 'read'
 * })
 *
 * if (!result.allowed) {
 *   return error(403, { message: result.reason })
 * }
 *
 * const projects = await db.project.findMany({
 *   where: {
 *     ...result.whereCondition,  // 应用 Scope 限制
 *     // 其他查询条件...
 *   }
 * })
 * ```
 */
export async function checkPermissionWithScope(
  userId: string,
  check: PermissionCheck
): Promise<PermissionWithScopeResult> {
  const permissionService = getPermissionService()
  const scopeResolver = getScopeResolver()

  // 1. 检查权限
  const result = await permissionService.checkPermission(userId, check)

  if (!result.allowed) {
    return {
      allowed: false,
      reason: result.reason,
      whereCondition: null
    }
  }

  // 2. 如果没有 Scope 限制，直接返回
  if (!result.scope) {
    return {
      allowed: true,
      whereCondition: null
    }
  }

  // 3. 获取用户上下文（用于解析 Scope）
  const userContext = await permissionService.getUserContext(userId)
  if (!userContext) {
    return {
      allowed: false,
      reason: '用户不存在',
      whereCondition: null
    }
  }

  // 4. 解析 Scope 条件
  const whereCondition = await scopeResolver.resolveScope(
    check.resource,
    userContext
  )

  return {
    allowed: true,
    whereCondition
  }
}

/**
 * 合并 Scope 条件与业务查询条件
 *
 * @example
 * ```typescript
 * const where = mergeScopeWithQuery(scopeCondition, {
 *   status: 'ACTIVE',
 *   name: { contains: searchQuery }
 * })
 * ```
 */
export function mergeScopeWithQuery(
  scopeCondition: Record<string, unknown> | null,
  queryCondition: Record<string, unknown>
): Record<string, unknown> {
  if (!scopeCondition) {
    return queryCondition
  }

  // 如果 Scope 有 AND 条件，需要合并
  if (scopeCondition.AND) {
    return {
      AND: [
        ...(Array.isArray(scopeCondition.AND) ? scopeCondition.AND : [scopeCondition.AND]),
        queryCondition
      ]
    }
  }

  // 简单合并
  return {
    ...scopeCondition,
    ...queryCondition
  }
}

/**
 * 检查是否为管理员（跳过 Scope 限制）
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const permissionService = getPermissionService()

  // 检查是否有超级管理员角色
  const hasAdminRole = await permissionService.hasRole(userId, 'admin')
  if (hasAdminRole) return true

  // 检查是否有通配权限
  const result = await permissionService.checkPermission(userId, {
    resource: '*',
    action: 'manage'
  })

  return result.allowed
}

/**
 * 带权限检查的查询构建器
 *
 * @example
 * ```typescript
 * const { where, skip, take } = await buildScopedQuery(
 *   userId,
 *   { resource: 'project', action: 'read' },
 *   { status: 'ACTIVE' },
 *   { page: 1, limit: 20 }
 * )
 *
 * const [projects, total] = await Promise.all([
 *   db.project.findMany({ where, skip, take }),
 *   db.project.count({ where })
 * ])
 * ```
 */
export async function buildScopedQuery(
  userId: string,
  permission: PermissionCheck,
  baseFilter: Record<string, unknown> = {},
  pagination?: { page?: number; limit?: number }
): Promise<{
  where: Record<string, unknown>
  skip?: number
  take?: number
}> {
  // 1. 检查权限和 Scope
  const result = await checkPermissionWithScope(userId, permission)

  if (!result.allowed) {
    // 权限不足时返回不可能匹配的条件
    return {
      where: { id: '__PERMISSION_DENIED__' }
    }
  }

  // 2. 合并 Scope 和业务条件
  const where = mergeScopeWithQuery(result.whereCondition, baseFilter)

  // 3. 处理分页
  const page = pagination?.page ?? 1
  const limit = pagination?.limit ?? 20

  return {
    where,
    skip: (page - 1) * limit,
    take: limit
  }
}
