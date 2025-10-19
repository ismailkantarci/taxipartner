import React, { useEffect, useRef } from 'react';
import Notice403 from '../feedback/Notice403';
import { useCan } from '../../lib/rbac/guard';
import type { PermissionKey } from '../../lib/rbac/policy';
import { push } from '../../lib/notifications/store';

type RequirePermissionProps = {
  permission: PermissionKey;
  children: React.ReactNode;
  title?: string;
  description?: string;
};

const RequirePermission: React.FC<RequirePermissionProps> = ({
  permission,
  children,
  title,
  description
}) => {
  const allowed = useCan(permission);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!allowed && !notifiedRef.current) {
      push({
        type: 'warning',
        title: 'NOTICE_DENIED',
        body: `Access denied: ${permission}`
      });
      notifiedRef.current = true;
    }
  }, [allowed, permission]);

  if (!allowed) {
    return (
      <Notice403
        title={title ?? 'Access denied'}
        description={
          description ??
          'You do not currently have permission to view this area. Switch to a role with access or contact an administrator.'
        }
      />
    );
  }

  return <>{children}</>;
};

export default RequirePermission;
