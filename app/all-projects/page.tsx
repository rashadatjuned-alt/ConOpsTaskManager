<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All Projects - ConOps Tasker</title>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    /* Dark Mode Theme Variables */
    :root {
      --bg-dark: #121212;
      --bg: #1e1e1e;
      --bg2: #2a2a2a;
      --brd: #333333;
      --txt: #ffffff;
      --txt2: #cccccc;
      --txt3: #999999;
      --primary: #4ade80;
      --danger: #ef4444;
      --r: 6px;
      --rl: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    body {
      margin: 0;
      background-color: var(--bg-dark);
      color: var(--txt);
      display: flex;
      height: 100vh;
    }

    /* Mock Sidebar Layout */
    .sidebar { width: 220px; background-color: #000; border-right: 1px solid var(--brd); padding: 16px; }
    .main-content { flex: 1; padding: 24px 32px; overflow-y: auto; }
    
    h1 { font-size: 18px; margin: 0 0 20px 0; font-weight: 600; }

    /* Controls */
    .controls-row { display: flex; justify-content: space-between; margin-bottom: 16px; align-items: center; }
    .search-box { position: relative; width: 260px; }
    .search-box i { position: absolute; left: 10px; top: 8px; color: var(--txt3); width: 14px; height: 14px; }
    .search-box input {
      width: 100%; box-sizing: border-box; padding: 6px 10px 6px 30px;
      background: var(--bg); border: 1px solid var(--brd); border-radius: var(--r);
      color: var(--txt); font-size: 13px; outline: none;
    }
    .btn-new {
      background: var(--primary); color: #000; border: none; padding: 6px 12px;
      border-radius: var(--r); font-size: 12px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; gap: 6px;
    }

    /* Project Cards (COMPACT) */
    .proj-card { background: var(--bg); border: 1px solid var(--brd); border-radius: var(--rl); margin-bottom: 12px; overflow: hidden; }
    .proj-header {
      padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;
      cursor: pointer; transition: background 0.2s;
    }
    .proj-header:hover { background: var(--bg2); }
    .header-left { display: flex; align-items: center; gap: 10px; flex: 1; }
    .chevron { transition: transform 0.2s; color: var(--txt3); }
    .chevron.open { transform: rotate(90deg); }
    .proj-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .proj-title { font-size: 14px; font-weight: 500; color: var(--txt); }
    
    .header-right { display: flex; align-items: center; gap: 16px; }
    .progress-container { display: flex; align-items: center; gap: 8px; width: 100px; }
    .progress-track { flex: 1; height: 4px; background: var(--brd); border-radius: 2px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
    .actions { display: flex; gap: 4px; }
    .icon-btn {
      background: transparent; border: 1px solid transparent; border-radius: 4px;
      width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
      color: var(--txt3); cursor: pointer; transition: 0.2s;
    }
    .icon-btn:hover { background: var(--bg2); color: var(--txt); border-color: var(--brd); }
    .icon-btn.danger { color: var(--danger); }
    .icon-btn.danger:hover { background: rgba(239, 68, 68, 0.1); border-color: transparent; }

    /* Task List (COMPACT) */
    .task-list { padding: 4px 14px 12px 34px; border-top: 1px solid var(--brd); display: none; }
    .task-list.open { display: block; }
    .task-row {
      display: flex; justify-content: space-between; align-items: center;
      background: transparent; border-bottom: 1px solid var(--bg2);
      padding: 6px 0;
    }
    .task-row:last-child { border-bottom: none; }
    
    /* Status Pills */
    .pill { padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .pill.completed { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
    .pill.not-started { background: rgba(255, 255, 255, 0.1); color: var(--txt2); }
    .pill.in-progress { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
  </style>
</head>
<body>

  <div class="sidebar">
    <div style="font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; margin-bottom: 32px;">
      <i data-lucide="layout-dashboard" style="width: 18px;"></i> ConOps Tasker
    </div>
    <div style="color: var(--txt3); font-size: 11px; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 10px;">MANAGEMENT</div>
    <div style="background: rgba(74, 222, 128, 0.1); color: var(--primary); padding: 6px 10px; border-radius: var(--r); font-size: 13px; font-weight: 500;">
      <i data-lucide="folder" style="width:14px; height:14px; vertical-align: text-bottom; margin-right: 6px;"></i> All Projects
    </div>
  </div>

  <div class="main-content">
    
    <div class="controls-row">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div class="search-box">
          <i data-lucide="search"></i>
          <input type="text" id="searchInput" placeholder="Search projects..." oninput="renderProjects()">
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 12px; color: var(--txt3);" id="projectCount"></div>
        <button class="btn-new"><i data-lucide="plus" style="width: 13px; height: 13px;"></i> New Project</button>
      </div>
    </div>

    <div id="project-container"></div>
  </div>

  <script>
    // --- Mock Data ---
    const projects = [
      { id: 1, name: 'Customer Purchase Order Management', color: '#3b82f6', description: 'Track and escalate PO issues.' },
      { id: 2, name: 'AI Video Project', color: '#8b5cf6', description: 'Explore AI tools for video generation.' },
      { id: 3, name: 'Contract Operations Core Activity', color: '#f59e0b', description: 'Core contract validations.' }
    ];

    const tasks = [
      { id: 101, projectId: 1, name: 'Monthly closed SR of purchased order', status: 'Completed', start: '2026-05-01', end: '2026-05-15' },
      { id: 102, projectId: 1, name: 'Validated opportunity PO review', status: 'Not Started', start: '—', end: '2026-05-17' },
      { id: 103, projectId: 1, name: 'Review all open/on hold PO ticket', status: 'Not Started', start: '—', end: '2026-05-17' },
      { id: 104, projectId: 2, name: 'Explore AI tool', status: 'In Progress', start: '2026-05-11', end: '2026-06-18' },
      { id: 105, projectId: 3, name: 'Opportunity Validation', status: 'In Progress', start: '2026-05-20', end: '2026-06-30' }
    ];

    // State for toggling accordions
    const openProjects = { 1: true, 2: true }; // Open first two by default

    function toggleProject(id) {
      openProjects[id] = !openProjects[id];
      renderProjects();
    }

    function getStatusClass(status) {
      if (status === 'Completed') return 'completed';
      if (status === 'In Progress') return 'in-progress';
      return 'not-started';
    }

    // --- Render Logic ---
    function renderProjects() {
      const container = document.getElementById('project-container');
      const countLabel = document.getElementById('projectCount');
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      
      const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchTerm));
      
      countLabel.innerText = `${filteredProjects.length} project${filteredProjects.length !== 1 ? 's' : ''}`;

      if (filteredProjects.length === 0) {
        container.innerHTML = '<div style="color: var(--txt3); font-size: 13px;">No projects found.</div>';
        lucide.createIcons();
        return;
      }

      let html = '';

      filteredProjects.forEach(proj => {
        const projTasks = tasks.filter(t => t.projectId === proj.id);
        const completedCount = projTasks.filter(t => t.status === 'Completed').length;
        const progressPct = projTasks.length > 0 ? Math.round((completedCount / projTasks.length) * 100) : 0;
        const isOpen = !!openProjects[proj.id];

        html += `
          <div class="proj-card">
            <div class="proj-header" onclick="toggleProject(${proj.id})">
              <div class="header-left">
                <i data-lucide="chevron-right" class="chevron ${isOpen ? 'open' : ''}" style="width: 14px; height: 14px;"></i>
                <div class="proj-dot" style="background: ${proj.color}"></div>
                <div class="proj-title">${proj.name}</div>
                <div style="font-size: 12px; color: var(--txt3); margin-left: 4px;">${projTasks.length} task${projTasks.length !== 1 ? 's' : ''}</div>
              </div>
              
              <div class="header-right">
                <div class="progress-container">
                  <span style="font-size: 11px; color: var(--txt3); font-weight: 500; min-width: 24px;">${progressPct}%</span>
                  <div class="progress-track">
                    <div class="progress-fill" style="width: ${progressPct}%; background: ${proj.color}"></div>
                  </div>
                </div>
                
                <div class="actions">
                  <button class="icon-btn" title="Info" onclick="event.stopPropagation(); alert('Info modal for ${proj.name}')"><i data-lucide="info" style="width: 13px;"></i></button>
                  <button class="icon-btn" title="Add Task" onclick="event.stopPropagation()"><i data-lucide="plus" style="width: 13px;"></i></button>
                  <button class="icon-btn danger" title="Delete" onclick="event.stopPropagation()"><i data-lucide="trash-2" style="width: 13px;"></i></button>
                </div>
              </div>
            </div>

            <div class="task-list ${isOpen ? 'open' : ''}">
              ${projTasks.length === 0 ? '<div style="font-size: 12px; color: var(--txt3); padding: 4px 0;">No tasks.</div>' : ''}
              ${projTasks.map(t => `
                <div class="task-row">
                  <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <div style="width: 6px; height: 6px; border-radius: 50%; border: 1.5px solid var(--txt3);"></div>
                    <div style="font-size: 13px; color: var(--txt);">${t.name}</div>
                  </div>
                  
                  <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="font-size: 11px; color: var(--txt3); display: flex; align-items: center; gap: 4px; width: 130px; justify-content: flex-end;">
                      ${t.start} <span>→</span> ${t.end}
                    </div>
                    
                    <div style="width: 80px; text-align: right;">
                      <span class="pill ${getStatusClass(t.status)}">${t.status}</span>
                    </div>

                    <div style="display: flex; gap: 4px; padding-left: 12px;">
                      <button style="background: var(--bg2); border: 1px solid transparent; color: var(--txt2); padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: 0.2s;">Edit</button>
                      <button class="icon-btn danger" style="width: 22px; height: 22px;"><i data-lucide="trash-2" style="width: 12px;"></i></button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      
      // Re-initialize icons after injecting HTML
      lucide.createIcons();
    }

    // Initial Render
    document.addEventListener("DOMContentLoaded", () => {
      renderProjects();
    });
  </script>
</body>
</html>
