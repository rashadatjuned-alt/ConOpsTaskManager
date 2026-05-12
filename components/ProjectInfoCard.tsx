'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

interface ProjectInfoCardProps {
  project: any;
  tasks: any[];
  subtasks: any[];
  myRole: string;
  allUsers: any[];           // ← NEW: pass your full Users list here
  onClose?: () => void;      // ← NEW: optional close handler
}

export default function ProjectInfoCard({
  project,
  tasks,
  subtasks,
  myRole,
  allUsers,
  onClose,
}: ProjectInfoCardProps) {
  const router = useRouter();

  // ── Calculations ─────────────────────────────────────────────────────
  const { startDate, endDate, totalTasks, totalSubtasks, progress } = useMemo(() => {
    const validTasks = tasks.filter((t) => t.start_date && t.end_date);

    const earliest = validTasks.length
      ? new Date(Math.min(...validTasks.map((t) => new Date(t.start_date).getTime())))
      : null;

    const latest = validTasks.length
      ? new Date(Math.max(...validTasks.map((t) => new Date(t.end_date).getTime())))
      : null;

    const totalT = tasks.length;
    const totalS = subtasks.length;

    const completedTasks = tasks.filter((t) => t.status === 'completed' || t.is_completed === true).length;
    const completedSubtasks = subtasks.filter((s) => s.status === 'completed' || s.is_completed === true).length;
    const totalItems = totalT + totalS || 1;
    const completedItems = completedTasks + completedSubtasks;
    const prog = Math.round((completedItems / totalItems) * 100);

    return {
      startDate: earliest,
      endDate: latest,
      totalTasks: totalT,
      totalSubtasks: totalS,
      progress: prog,
    };
  }, [tasks, subtasks]);

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const canEdit = myRole === 'Admin' || myRole === 'Manager';

  const handleEdit = () => {
    router.push(`/edit-project/${project.id}`);
  };

  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  // Real user lookup
  const getUser = (userId: string) => allUsers.find((u: any) => u.id === userId) || { full_name: userId, email: userId };

  const teamMembers = project.members || [];
  const displayedMembers = teamMembers.slice(0, 4);

  return (
    <div
      style={{
        maxWidth: 480,
        background: 'var(--card-bg)',
        border: '1px solid var(--card-brd)',
        borderRadius: 14,
        padding: 16,
        boxShadow: '0 8px 12px -3px rgba(0,0,0,0.1)',
        fontFamily: 'inherit',
        position: 'relative',
      }}
    >
      {/* Close Button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 28,
          height: 28,
          border: 'none',
          background: 'transparent',
          color: 'var(--txt3)',
          fontSize: 22,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        ×
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 26,
            height: 26,
            background: project.color_code || '#3b82f6',
            borderRadius: 8,
            flexShrink: 0,
          }}
        />
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, flex: 1 }}>
          {project.name}
        </h2>
        <span
          style={{
            background: project.color_code || '#3b82f6',
            color: '#fff',
            padding: '3px 9px',
            borderRadius: 9999,
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          {project.color_code || '#3b82f6'}
        </span>
      </div>

      {/* Description */}
      <p style={{ color: '#64748b', lineHeight: 1.4, fontSize: 13, marginBottom: 14 }}>
        {project.description || 'No description provided.'}
      </p>

      {/* Timeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14 }}>
        <span style={{ color: '#64748b', fontSize: 15 }}>📅</span>
        <span><strong>{formatDate(startDate)}</strong></span>
        <span style={{ color: '#64748b' }}>→</span>
        <span><strong>{formatDate(endDate)}</strong></span>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Progress</span>
          <span style={{ fontWeight: 600, color: '#22c55e' }}>{progress}% Complete</span>
        </div>
        <div style={{ height: 8, background: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#22c55e' }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--brd2)' }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>TASKS</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{totalTasks}</div>
        </div>
        <div style={{ width: 1, background: 'var(--brd2)', alignSelf: 'stretch', margin: '0 12px' }} />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>SUBTASKS</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{totalSubtasks}</div>
        </div>
      </div>

      {/* Team - REAL NAMES */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          👥 TEAM ({teamMembers.length})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {displayedMembers.map((memberId: string) => {
            const user = getUser(memberId);
            const name = user.full_name || user.email || memberId;
            const ini = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

            return (
              <div
                key={memberId}
                style={{
                  padding: '4px 10px',
                  borderRadius: 9999,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#8b5cf6',
                    color: '#fff',
                    fontSize: 9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {ini}
                </div>
                {name}
              </div>
            );
          })}
          {teamMembers.length > 4 && (
            <div style={{ padding: '4px 10px', borderRadius: 9999, fontSize: 12, color: '#64748b', paddingTop: 5 }}>
              +{teamMembers.length - 4} more
            </div>
          )}
        </div>
      </div>

      {/* Edit Button */}
      {canEdit && (
        <button
          onClick={handleEdit}
          style={{
            marginTop: 20,
            width: '100%',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            padding: 11,
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          ✏️ Edit Project
        </button>
      )}
    </div>
  );
}
