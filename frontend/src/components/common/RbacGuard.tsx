import React, { type ReactNode } from 'react';

interface RbacGuardProps {
  permission: string;
  userPermissions?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RbacGuard(props: RbacGuardProps) {
  const { permission, userPermissions, children, fallback = null } = props;
  const permissions = userPermissions ?? [];
  const hasPermission = permissions.includes(permission);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}