'use client';

import {useCallback, useEffect, useState} from 'react';

import type {Role} from '@/types/trade';

const STORAGE_KEY = 'timx.role';

function isRole(value: string | null): value is Role {
  return value === 'buyer' || value === 'supplier' || value === 'financier';
}

/**
 * The user's active role.
 *
 * Role is a UI lens, not a permission: the contracts decide what an address may do based on its
 * position in each trade, so switching role here changes what is emphasised, never what is
 * allowed. Persisted locally; the durable copy lives in Supabase against the wallet address.
 */
export function useRole() {
  const [role, setRoleState] = useState<Role>('buyer');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isRole(stored)) setRoleState(stored);
    setHydrated(true);
  }, []);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return {role, setRole, hydrated};
}
