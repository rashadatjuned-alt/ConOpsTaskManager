import React from 'react';
// Import your icons or Link from next/link as needed
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Sidebar = () => {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  const navItems = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Tasks', href: '/tasks' },
    // ... add your other items here
  ];

  return (
    <aside style={{ width: '250px', height: '100vh', borderRight: '1px solid var(--border)' }}>
      <nav>
        {navItems.map(({ name, href }) => (
          <Link
            key={href}
            href={href}
            style={{
              // These lines were the source of the build error:
              background: isActive(href) ? 'var(--nav-active-bg)' : 'transparent',
              color: isActive(href) ? 'var(--nav-active-txt)' : 'var(--txt2)',
              display: 'flex',          // Only one 'display' property allowed
              flexDirection: 'row',
              alignItems: 'center',
              padding: '12px 20px',
              textDecoration: 'none',
              borderRadius: '8px',
              margin: '4px 8px'
            }}
          >
            {name}
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
