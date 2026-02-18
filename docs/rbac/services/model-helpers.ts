// src/services/rbac/model-types.ts

import type { PrismaClient } from '@prisma/client'

/**
 * 支持所有权检查的 Prisma 模型类型
 */
export type OwnableModel = 'project' | 'task'

/**
 * 所有 RBAC 资源类型
 */
export type RbacResource = OwnableModel | 'user' | 'role' | 'permission' | '*'

/**
 * 权限操作类型
 */
export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'

/**
 * 权限字符串类型
 */
export type PermissionString<R extends string = string, A extends PermissionAction = PermissionAction> =
  `${R}:${A}`

/**
 * 所有权字段映射
 * 定义每个资源的所有权检查字段
 */
export interface OwnershipFieldMap {
  project: 'ownerId'
  task: 'creatorId' | 'assigneeId' | 'projectId'
}

/**
 * 获取资源的所有权字段类型
 */
export type OwnershipField<T extends OwnableModel> = OwnershipFieldMap[T]

/**
 * Prisma 模型选择器类型
 */
export type ModelSelector<T extends OwnableModel> = {
  [K in T]: {
    findUnique: (args: {
      where: { id: string }
      select: { [F in OwnershipField<K>]: true }
    }) => Promise<{ [F in OwnershipField<K>]: string } | null>
    findMany: (args?: {
      where?: Record<string, unknown>
      select?: Record<string, boolean>
    }) => Promise<unknown[]>
  }
}[T]

/**
 * 类型安全的 Prisma 模型访问器
 */
export class TypedModelAccessor {
  constructor(private db: PrismaClient) {}

  /**
   * 获取支持所有权检查的模型
   * 类型安全，避免 any
   */
  getOwnableModel<T extends OwnableModel>(
    resourceType: T
  ): {
    findUnique: (args: {
      where: { id: string }
      select: Record<OwnershipField<T>, true>
    }) => Promise<Record<OwnershipField<T>, string> | null>
  } {
    const modelMap: Record<OwnableModel, unknown> = {
      project: this.db.project,
      task: this.db.task
    }

    const model = modelMap[resourceType]
    if (!model) {
      throw new Error(`Unknown ownable model: ${resourceType}`)
    }

    return model as ReturnType<TypedModelAccessor['getOwnableModel']<T>>
  }

  /**
   * 检查资源类型是否支持所有权
   */
  isOwnable(resourceType: string): resourceType is OwnableModel {
    return resourceType === 'project' || resourceType === 'task'
  }

  /**
   * 获取所有权字段列表
   */
  getOwnershipFields<T extends OwnableModel>(
    resourceType: T
  ): OwnershipField<T>[] {
    const fieldMap: Record<OwnableModel, string[]> = {
      project: ['ownerId'],
      task: ['creatorId', 'assigneeId', 'projectId']
    }

    return fieldMap[resourceType] as OwnershipField<T>[]
  }
}

/**
 * 权限检查类型（强化类型）
 */
export interface TypedPermissionCheck<
  R extends RbacResource = RbacResource,
  A extends PermissionAction = PermissionAction
> {
  resource: R
  action: A
}

/**
 * 创建类型安全的权限检查
 */
export function createPermissionCheck<
  R extends RbacResource,
  A extends PermissionAction
>(resource: R, action: A): TypedPermissionCheck<R, A> {
  return { resource, action }
}

/**
 * 权限字符串解析器
 */
export function parsePermissionString(
  permission: PermissionString
): { resource: string; action: PermissionAction } | null {
  const parts = permission.split(':')
  if (parts.length !== 2) return null

  const [resource, action] = parts
  const validActions: PermissionAction[] = [
    'create',
    'read',
    'update',
    'delete',
    'manage'
  ]

  if (!validActions.includes(action as PermissionAction)) {
    return null
  }

  return { resource, action: action as PermissionAction }
}

/**
 * 权限字符串构建器
 */
export function buildPermissionString<
  R extends string,
  A extends PermissionAction
>(resource: R, action: A): PermissionString<R, A> {
  return `${resource}:${action}`
}
