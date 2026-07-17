'use client';

import { PageHeader, PageShell } from '../PageShell';

export function LabShell({ title, subtitle, children, action }) {
  return (
    <PageShell>
      <PageHeader title={title} description={subtitle} action={action} />
      {children}
    </PageShell>
  );
}
