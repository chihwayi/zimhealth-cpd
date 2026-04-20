import { Sidebar } from './Sidebar';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

