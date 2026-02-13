import mongoose from 'mongoose';
import { Order, User } from '@/lib/models';
import type { OrderAssignmentInput } from '@/lib/validations';

export type AssignableRole = 'server' | 'servent';

export interface AssignmentTarget {
  _id: mongoose.Types.ObjectId;
  username: string;
  role: AssignableRole;
}

const ACTIVE_ORDER_STATUSES = ['ongoing', 'completed'] as const;

function isAssignableRole(role: string): role is AssignableRole {
  return role === 'server' || role === 'servent';
}

export async function findActiveAssigneeById(
  assigneeId: string,
  role: AssignableRole
): Promise<AssignmentTarget | null> {
  if (!mongoose.Types.ObjectId.isValid(assigneeId)) {
    return null;
  }

  const assignee = await User.findOne({
    _id: assigneeId,
    role,
    isActive: true,
  })
    .select('_id username role')
    .lean();

  if (!assignee || !isAssignableRole(assignee.role)) {
    return null;
  }

  return {
    _id: assignee._id as mongoose.Types.ObjectId,
    username: assignee.username,
    role: assignee.role,
  };
}

export async function findLeastLoadedAssignee(role: AssignableRole): Promise<AssignmentTarget | null> {
  const candidates = await User.find({ role, isActive: true })
    .select('_id username role')
    .lean();

  if (candidates.length === 0) {
    return null;
  }

  const candidateObjectIds = candidates.map((candidate) => candidate._id);

  const loadRows = await Order.aggregate([
    {
      $match: {
        status: { $in: ACTIVE_ORDER_STATUSES },
        deliveryAssigneeRole: role,
        deliveryAssigneeId: { $in: candidateObjectIds },
        items: { $elemMatch: { isDelivered: false } },
      },
    },
    {
      $group: {
        _id: '$deliveryAssigneeId',
        count: { $sum: 1 },
      },
    },
  ]);

  const loadByUserId = new Map<string, number>();
  for (const row of loadRows) {
    if (row?._id) {
      loadByUserId.set(String(row._id), Number(row.count) || 0);
    }
  }

  const sortedCandidates = candidates
    .map((candidate) => ({
      _id: candidate._id as mongoose.Types.ObjectId,
      username: candidate.username,
      role: candidate.role,
      load: loadByUserId.get(String(candidate._id)) ?? 0,
    }))
    .filter((candidate) => isAssignableRole(candidate.role))
    .sort((a, b) => {
      if (a.load !== b.load) return a.load - b.load;
      return a.username.localeCompare(b.username);
    });

  const bestCandidate = sortedCandidates[0];
  if (!bestCandidate) {
    return null;
  }

  return {
    _id: bestCandidate._id,
    username: bestCandidate.username,
    role: bestCandidate.role as AssignableRole,
  };
}

export async function resolveAssignee(assignment: OrderAssignmentInput): Promise<{
  assignee: AssignmentTarget | null;
  error?: string;
}> {
  if (assignment.mode === 'manual') {
    if (!assignment.assigneeId) {
      return { assignee: null, error: 'Assignee is required for manual assignment' };
    }

    const assignee = await findActiveAssigneeById(assignment.assigneeId, assignment.assigneeRole);
    if (!assignee) {
      return { assignee: null, error: `${assignment.assigneeRole} is unavailable` };
    }

    return { assignee };
  }

  const assignee = await findLeastLoadedAssignee(assignment.assigneeRole);
  if (!assignee) {
    return { assignee: null, error: `No active ${assignment.assigneeRole} accounts available` };
  }

  return { assignee };
}
