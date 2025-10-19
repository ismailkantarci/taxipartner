import React from 'react';
import ComplianceCategoryPage from './ComplianceCategoryPage';

const ExternalAuditFindingsPage: React.FC = () => (
  <ComplianceCategoryPage
    category="external-audit-findings"
    title="External audit findings"
    description="Monitor open findings from city and third-party audits."
  />
);

export default ExternalAuditFindingsPage;
