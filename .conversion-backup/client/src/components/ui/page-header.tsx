import { FC } from 'react';

interface PageHeaderProps {
  heading: string;
  subheading?: string;
}

export const PageHeader: FC<PageHeaderProps> = ({ heading, subheading }) => {
  return (
    <div className="flex flex-col gap-2 mb-6 px-4 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
      {subheading && <p className="text-muted-foreground">{subheading}</p>}
    </div>
  );
};