import React from 'react';
import ComplianceCategoryPage from './ComplianceCategoryPage';

const PackagesPage: React.FC = () => (
  <ComplianceCategoryPage
    category="packages"
    title="Compliance packages"
    description="Manage bundled compliance requirements and their execution cadence."
  />
);

export default PackagesPage;
