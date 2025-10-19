import React from 'react';
import ComplianceCategoryPage from './ComplianceCategoryPage';

const ExceptionsPage: React.FC = () => (
  <ComplianceCategoryPage
    category="exceptions"
    title="Compliance exceptions"
    description="Document and track approved compliance deviations and their expirations."
  />
);

export default ExceptionsPage;
