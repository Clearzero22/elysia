// src/services/rbac/ownership-service.ts

import { db } from '../../db/prisma'
import { AsyncInitializable } from './base-service'
import type { OwnershipResult } from './types'

interface OwnershipPolicyData {
  id: string
  resource: string
  field: string
  condition: string | null
  priority: number
}

/**
 * 所有权检查服务
 * 支持延迟初始化和策略热刷新
 */
export class OwnershipService extends AsyncInitializable {
  private policies = new Map<string, OwnershipPolicyData[]>()
  private refreshInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    // 不在 constructor 中调用异步方法
  }

  /**
   * 初始化：从数据库加载策略
   */
  protected async onInitialize(): Promise<void> {
    await this.loadPolicies()
    this.startPeriodicRefresh()
  }

  /**
   * 从数据库加载所有权策略
   */
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

    // 原子替换
    this.policies = newPolicies
  }

  /**
   * 定期刷新策略（可选）
   */
  private startPeriodicRefresh(): void {
    // 每 5 分钟刷新一次策略
    this.refreshInterval = setInterval(async () => {
      try {
        await this.loadPolicies()
      } catch (error) {
        console.error('Failed to refresh ownership policies:', error)
      }
    }, 5 * 60 * 1000)
  }

  /**
   * 手动刷新策略
   */
  async refreshPolicies(): Promise<void> {
    await this.loadPolicies()
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
  }

  /**
   * 检查用户是否是资源的所有者
   */
  async checkOwnership(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<OwnershipResult> {
    // 确保已初始化
    await this.ensureInitialized()

    const policies = this.policies.get(resourceType) || []

    for (const policy of policies) {
      const isOwner = await this.checkPolicy(userId, resourceId, policy)
      if (isOwner) {
        return { isOwner: true, policy: policy.field }
      }
    }

    return { isOwner: false }
  }

  /**
   * 获取资源的查询条件（用于列表查询）
   * 返回 null 表示用户不是任何资源的所有者
   */
  async getOwnershipConditions(
    userId: string,
    resourceType: string
  ): Promise<Record<string, unknown> | null> {
    await this.ensureInitialized()

    const policies = this.policies.get(resourceType) || []
    const conditions: Record<string, unknown>[] = []

    for (const policy of policies) {
      const condition = this.buildOwnershipCondition(userId, policy)
      if (condition) {
        conditions.push(condition)
      }
    }

    if (conditions.length === 0) {
      return null
    }

    return conditions.length === 1 ? conditions[0] : { OR: conditions }
  }

  /**
   * 检查单个策略
   */
  private async checkPolicy(
    userId: string,
    resourceId: string,
    policy: OwnershipPolicyData
  ): Promise<boolean> {
    const model = this.getModel(policy.resource)
    if (!model) return false

    const resource = await model.findUnique({
      where: { id: resourceId },
      select: { [policy.field]: true }
    })

    if (!resource) return false

    // 检查所有权字段
    if (resource[policy.field as keyof typeof resource] === userId) {
      return true
    }

    // 检查额外条件
    if (policy.condition) {
      try {
        const condition = JSON.parse(policy.condition)
        return await this.evaluateCondition(userId, resourceId, condition)
      } catch (error) {
        console.error(`Invalid condition JSON for policy ${policy.id}:`, error)
        return false
      }
    }

    return false
  }

  /**
   * 构建所有权查询条件
   */
  private buildOwnershipCondition(
    userId: string,
    policy: OwnershipPolicyData
  ): Record<string, unknown> | null {
    const baseCondition = { [policy.field]: userId }

    // 如果有复杂条件，需要更复杂的查询构建
    // 这里简化处理，实际项目中可以扩展
    if (policy.condition) {
      return baseCondition
    }

    return baseCondition
  }

  /**
   * 获取 Prisma 模型
   */
  private getModel(resourceType: string) {
    const modelMap: Record<string, typeof db.project | typeof db.task> = {
      project: db.project,
      task: db.task
    }
    return modelMap[resourceType]
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
    // 处理关联条件
    if (condition.relation && condition.field) {
      // 例如：通过 project.ownerId 检查任务所有权
      if (condition.relation === 'project' && condition.field === 'ownerId') {
        const task = await db.task.findUnique({
          where: { id: resourceId },
          include: { project: { select: { ownerId: true } } }
        })
        return task?.project.ownerId === userId
      }
    }

    return false
  }
}

// 单例实例
let ownershipServiceInstance: OwnershipService | null = null

/**
 * 获取所有权服务单例
 */
export function getOwnershipService(): OwnershipService {
  if (!ownershipServiceInstance) {
    ownershipServiceInstance = new OwnershipService()
  }
  return ownershipServiceInstance
}

/**
 * 初始化所有权服务（应用启动时调用）
 */
export async function initializeOwnershipService(): Promise<void> {
  const service = getOwnershipService()
  await service.ensureInitialized()
}
