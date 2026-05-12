'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

interface ProjectInfoCardProps {
  project: any;
  tasks: any[];
  subtasks: any[];
  myRole: string;
  allUsers?: any[];          // ← made optional (safe)
  onClose?: () => void;
}

export default function ProjectInfoCard({
  project,
  tasks,
  subtasks,
  myRole,
  allUsers = [],            // ← default empty array
  onClose,
}: ProjectInfoCardProps) {
  const router = useRouter();

  // Calculations
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

  const handleEdit = () => router.push(`/edit-project/${project.id}`);

  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  // Fallback for team members (shows ID if no allUsers)
  const getUserName = (userId: string) => {
    const user = allUsers.find((u: any) => u.id === userId);
    return user?.full_name || user?.email || userId;
  };

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
        }}
      >
        ×
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 26, height: 26, background: project.color_code || '#3b82f6', borderRadius: 8 }} />
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, flex: 1 }}>{project.name}</h2>
        <span style={{ background: project.color_code || '#3b82f6', color: '#fff', padding: '3px 9px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600 }}>
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
        <div style={{ width: 1,
