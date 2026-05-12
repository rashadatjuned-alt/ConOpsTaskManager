'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AppShell from '@/components/layout/AppShell';
import ProjectInfoCard from '@/components/ProjectInfoCard';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [myRole, setMyRole] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Get current user role
      const { data: user } = await supabase
        .from('Users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      setMyRole(user?.role || '');

      // Fetch project + tasks + subtasks
      const [{ data: proj }, { data: allTasks }, { data: allSubs }] = await Promise.all([
        supabase.from('Projects').select('*').eq('id', id).single(),
        supabase.from('Tasks').select('*').eq('project_name', /* you may need to adjust this filter */ ''),
        supabase.from('Subtasks').select('*'),
      ]);

      if (proj) {
        setProject(proj);

        // Filter tasks for this project
        const projTasks = allTasks?.filter((t: any) => t.project_name === proj.name) || [];
        setTasks(projTasks);

        const projTaskIds = projTasks.map((t: any) => t.id);
        const projSubs = allSubs?.filter((s: any) => projTaskIds.includes(s.parent_task_id)) || [];
        setSubtasks(projSubs);
      }

      setLoading(false);
    };

    loadData();
  }, [id, router]);

  if (loading) {
    return (
      <AppShell title="Project Info">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading project...</div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell title="Project Info">
        <div style={{ padding: 40, color: 'var(--red)' }}>Project not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={project.name}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        <ProjectInfoCard
          project={project}
          tasks={tasks}
          subtasks={subtasks}
          myRole={myRole}
        />
      </div>
    </AppShell>
  );
}
