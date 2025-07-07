import { FC, ReactNode } from 'react';

interface ShellProps {
  children: ReactNode;
}

export const Shell: FC<ShellProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 pb-12 pt-4">
        {children}
      </main>
    </div>
  );
};