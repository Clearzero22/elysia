// src/services/rbac/ownership-service-v2.ts
// 类型安全版本的所有权服务

import { db } from '../../db/prisma'
import { AsyncInitializable } from './base-service'
import {
  TypedModelAccessor,
  type OwnableModel,
  type OwnershipField
} from './model-helpers'
import type { OwnershipResult } from './types'

/**
 * 所有权策略数据
 */
interface OwnershipPolicyData {
  id: string
  resource: string
  field: string
  condition: string | null
  priority: number
}

/**
 * 类型安全的所有权检查服务
 */
export class TypedOwnershipService extends AsyncInitializable {
  private policies = new Map<string, OwnershipPolicyData[]>()
  private modelAccessor: TypedModelAccessor
  private refreshInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.modelAccessor = new TypedModelAccessor(db)
  }

  protected async onInitialize(): Promise<void> {
    await this.loadPolicies()
    this.startPeriodicRefresh()
  }

  private async loadPolicies(): Promise<void> {
    const policies = await db.ownershipPolicy.findMany({
      orderBy: { priority: 'asc' }
    })

    const newPolicies = new Map<string, OwnershipPolicyData[]>()

    for (const policy of policies) {
      const list = newPolicies.get(policy.resource) || []
      list.push(policy)
      newPolicies.set(policy.resource, list)
    }

    this.policies = newPolicies
  }

  private startPeriodicRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      try {
        await this.loadPolicies()
      } catch (error) {
        console.error('Failed to refresh ownership policies:', error)
      }
    }, 5 * 60 * 1000)
  }

  async refreshPolicies(): Promise<void> {
    await this.loadPolicies()
  }

  dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
  }

  /**
   * 检查用户是否是资源的所有者（类型安全）
   */
  async checkOwnership<T extends OwnableModel>(
    userId: string,
    resourceType: T,
    resourceId: string
  ): Promise<OwnershipResult> {
    await this.ensureInitialized()

    // 验证资源类型
    if (!this.modelAccessor.isOwnable(resourceType)) {
      return { isOwner: false }
    }

    const policies = this.policies.get(resourceType) || []

    for (const policy of policies) {
      const isOwner = await this.checkPolicy(
        userId,
        resourceId,
        policy,
        resourceType
      )
      if (isOwner) {
        return { isOwner: true, policy: policy.field }
      }
    }

    return { isOwner: false }
  }

  /**
   * 检查单个策略（类型安全）
   */
  private async checkPolicy<T extends OwnableModel>(
    userId: string,
    resourceId: string,
    policy: OwnershipPolicyData,
    resourceType: T
  ): Promise<boolean> {
    const field = policy.field as OwnershipField<T>

    try {
      const model = this.modelAccessor.getOwnableModel(resourceType)

      const resource = await model.findUnique({
        where: { id: resourceId },
        select: { [field]: true } as Record<OwnershipField<T>, true>
      })

      if (!resource) return false

      // 类型安全地检查字段值
      const fieldValue = resource[field]
      if (fieldValue === userId) {
        return true
      }

      // 检查额外条件
      if (policy.condition) {
        const condition = JSON.parse(policy.condition)
        return this.evaluateCondition(userId, resourceId, condition)
      }
    } catch (error) {
      console.error(`Ownership check failed for ${resourceType}:${resourceId}:`, error)
    }

    return false
  }

  /**
   * 获取资源的查询条件（用于列表查询）
   */
  async getOwnershipConditions<T extends OwnableModel>(
    userId: string,
    resourceType: T
  ): Promise<Record<string, unknown> | null> {
    await this.ensureInitialized()

    if (!this.modelAccessor.isOwnable(resourceType)) {
      return null
    }

    const policies = this.policies.get(resourceType) || []
    const conditions: Record<string, unknown>[] = []

    for (const policy of policies) {
      conditions.push({ [policy.field]: userId })
    }

    if (conditions.length === 0) {
      return null
    }

    return conditions.length === 1 ? conditions[0] : { OR: conditions }
  }

  /**
   * 评估额外条件
   */
  private async evaluateCondition(
    userId: string,
    resourceId: string,
    condition: {
      relation?: string
      field?: string
      [key: string]: unknown
    }
  ): Promise<boolean> {
    if (condition.relation === 'project' && condition.field === 'ownerId') {
      const task = await db.task.findUnique({
        where: { id: resourceId },
        include: { project: { select: { ownerId: true } } }
      })
      return task?.project.ownerId === userId
    }

    return false
  }
}

// 单例
let typedOwnershipServiceInstance: TypedOwnershipService | null = null

export function getTypedOwnershipService(): TypedOwnershipService {
  if (!typedOwnershipServiceInstance) {
    typedOwnershipServiceInstance = new TypedOwnershipService()
  }
  return typedOwnershipServiceInstance
}

export async function initializeTypedOwnershipService(): Promise<void> {
  const service = getTypedOwnershipService()
  await service.ensureInitialized()
}
