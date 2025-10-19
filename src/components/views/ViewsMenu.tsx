import React, { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Download, MoreVertical, Save, Upload, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
  createView,
  listViews,
  removeView,
  setDefaultView,
  exportViews,
  importViews,
  getDefaultView
} from '../../lib/views/presets';
import { useGuardContext } from '../../lib/rbac/guard';

import type { ViewOwnerType } from '../../lib/views/presets';

export type ViewsMenuProps = {
  currentQuery: Record<string, unknown>;
  onApply: (query: Record<string, unknown>) => void;
  ownerType?: ViewOwnerType;
};

const OWNER_LABELS: Record<ViewOwnerType, string> = {
  user: 'Personal',
  tenant: 'Tenant',
  system: 'System'
};

const ViewsMenu: React.FC<ViewsMenuProps> = ({ currentQuery, onApply, ownerType = 'user' }) => {
  const location = useLocation();
  const route = location.pathname;
  const { currentTenantId } = useGuardContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [version, setVersion] = useState(0);
  const [saveScope, setSaveScope] = useState<ViewOwnerType>(ownerType);
  useEffect(() => {
    setSaveScope(ownerType);
  }, [ownerType]);

  const views = useMemo(() => listViews(route), [route, version]);
  const defaultView = useMemo(() => getDefaultView(route), [route, version]);

  const applyView = (viewId: string) => {
    const view = views.find(item => item.id === viewId);
    if (view) {
      onApply(view.query);
      setMenuOpen(false);
    }
  };

  const handleSave = () => {
    const name = window.prompt('View name');
    if (!name) return;
    createView({
      name,
      ownerType: saveScope,
      route,
      query: currentQuery,
      isDefault: false
    });
    setVersion(prev => prev + 1);
    setMenuOpen(false);
  };

  const handleDelete = (viewId: string) => {
    if (window.confirm('Delete this view?')) {
      removeView(viewId);
      setVersion(prev => prev + 1);
    }
  };

  const handleSetDefault = (viewId: string, viewOwner: ViewOwnerType) => {
    setDefaultView(route, viewOwner, viewId);
    setVersion(prev => prev + 1);
  };

  const handleExport = () => {
    const data = exportViews(route);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${route.replace(/\//g, '_')}-views.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    try {
      importViews(route, importText, saveScope);
      setVersion(prev => prev + 1);
      setImporting(false);
      setImportText('');
    } catch (error) {
      window.alert('Invalid preset JSON');
    }
  };

  return (
    <div className="relative" data-views-menu>
      <button
        type="button"
        onClick={() => setMenuOpen(prev => !prev)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
        Views
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {menuOpen ? (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-700 dark:text-slate-200">Saved views</p>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close views menu"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2 rounded-xl bg-slate-100/70 p-1 text-xs font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {(['user', 'tenant'] as ViewOwnerType[]).map(option => {
                const disabled = option === 'tenant' && !currentTenantId;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => !disabled && setSaveScope(option)}
                    disabled={disabled}
                    className={`flex-1 rounded-lg px-3 py-1 transition ${
                      saveScope === option
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                        : 'bg-transparent text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-900/60'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {OWNER_LABELS[option]}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              Personal defaults override tenant defaults, which override system presets.
            </p>
          </div>
          <div className="mt-2 max-h-60 space-y-2 overflow-y-auto">
            {views.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No views yet</p>
            ) : (
              views.map(view => (
                <div
                  key={view.id}
                  className="rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => applyView(view.id)}
                      className="text-left font-semibold text-slate-700 hover:underline dark:text-slate-200"
                    >
                      {view.name}
                    </button>
                    <span className="text-[10px] uppercase text-slate-400">
                      {OWNER_LABELS[view.ownerType]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => handleSetDefault(view.id, view.ownerType)}
                      className="text-[11px] underline-offset-2 hover:underline"
                    >
                      {defaultView?.id === view.id ? 'Default' : 'Set default'}
                    </button>
                    {view.ownerType !== 'system' ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(view.id)}
                        className="text-[11px] text-rose-500 underline-offset-2 hover:underline"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
            <button
              type="button"
              onClick={handleSave}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              Save current view
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => setImporting(prev => !prev)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Import JSON
            </button>
            {importing ? (
              <div className="space-y-2">
                <textarea
                  value={importText}
                  onChange={event => setImportText(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Paste JSON"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setImporting(false)}
                    className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                  >
                    Import
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ViewsMenu;
