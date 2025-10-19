import React from 'react';
import { Navigate } from 'react-router-dom';
import RequirePermission from '../components/rbac/RequirePermission';
import { TenantDetailPage as TenantDetailFeature } from '../features/tenants';

const USE_REACT_TENANTS =
  import.meta.env.VITE_USE_REACT_TENANTS === 'true' ||
  import.meta.env.VITE_USE_REACT_TENANTS === '1';

const TenantDetailPage: React.FC = () => {
  if (!USE_REACT_TENANTS) {
    return <Navigate to="/tenants" replace />;
  }

  return (
    <RequirePermission permission="tenants.manage">
      <TenantDetailFeature />
    </RequirePermission>
  );
};

export default TenantDetailPage;
