import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

type Primitive = string | number | boolean | string[];

type SchemaType = 'string' | 'number' | 'boolean' | 'string[]';

type QueryConfig<T extends Record<string, Primitive>> = {
  defaults: T;
  schema: { [K in keyof T]: SchemaType };
  mode?: 'replace' | 'push';
};

type PartialState<T> = {
  [K in keyof T]?: T[K];
};

const serialize = (schema: SchemaType, value: Primitive): string | null => {
  switch (schema) {
    case 'string':
      return value ? String(value) : null;
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value)
        ? String(value)
        : null;
    case 'boolean':
      return value ? '1' : null;
    case 'string[]':
      return Array.isArray(value) && value.length ? value.join(',') : null;
    default:
      return null;
  }
};

const parse = (schema: SchemaType, value: string | null, fallback: Primitive) => {
  if (value === null) return fallback;
  switch (schema) {
    case 'string':
      return value;
    case 'number': {
      const next = Number(value);
      return Number.isNaN(next) ? fallback : next;
    }
    case 'boolean':
      return value === '1' || value === 'true';
    case 'string[]':
      return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    default:
      return fallback;
  }
};

const buildState = <T extends Record<string, Primitive>>(
  searchParams: URLSearchParams,
  config: QueryConfig<T>
): T => {
  const entries = Object.entries(config.defaults).map(([key, fallback]) => {
    const schema = config.schema[key as keyof T];
    const value = parse(schema, searchParams.get(key), fallback);
    return [key, value];
  });
  return Object.fromEntries(entries) as T;
};

export const useQuerySync = <T extends Record<string, Primitive>>(
  config: QueryConfig<T>
): [T, (next: PartialState<T>) => void] => {
  const { defaults, schema, mode = 'replace' } = config;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const state = useMemo(
    () => buildState(searchParams, { defaults, schema, mode }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, defaults]
  );

  const update = useCallback(
    (next: PartialState<T>) => {
      const params = new URLSearchParams(searchParams);
      const merged = { ...state, ...next };

      (Object.keys(merged) as Array<keyof T>).forEach(key => {
        const serialized = serialize(schema[key], merged[key]);
        if (serialized === null || serialized === '') {
          params.delete(String(key));
        } else {
          params.set(String(key), serialized);
        }
      });

      navigate(
        {
          pathname: location.pathname,
          search: params.toString()
        },
        { replace: mode === 'replace' }
      );
    },
    [location.pathname, schema, searchParams, state, mode, navigate]
  );

  return [state, update];
};

export default useQuerySync;
