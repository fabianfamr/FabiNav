import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  Bookmark,
  History,
  Files,
  Globe,
  ShieldCheck
} from 'lucide-react';
import { BrowserProfile } from '../types';
import { INITIAL_PROFILE } from '../constants/initialData';

interface GoogleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: BrowserProfile;
  onUpdateProfile: (updates: Partial<BrowserProfile>) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  historyCount?: number;
  bookmarksCount?: number;
  openTabsCount?: number;
  topSitesCount?: number;
}

export const GoogleSyncModal: React.FC<GoogleSyncModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  onExportBackup,
  onImportBackup,
  historyCount = 0,
  bookmarksCount = 0,
  openTabsCount = 0,
  topSitesCount = 0
}) => {
  const safeProfile = profile || INITIAL_PROFILE;
  const [nameInput, setNameInput] = useState(safeProfile.name);
  const [emailInput, setEmailInput] = useState(safeProfile.email);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: nameInput.trim() || 'Usuario',
      email: emailInput.trim()
    });
    setSavedNotice('Perfil local actualizado.');
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportBackup(file);
    setSavedNotice('Respaldo JSON importado correctamente.');
    setTimeout(() => setSavedNotice(null), 2500);
    e.target.value = '';
  };

  const lastExportText = safeProfile.lastExportTimestamp
    ? new Date(safeProfile.lastExportTimestamp).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Aún no se ha exportado';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        id="profile-backup-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--bn-text)]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={safeProfile.avatarUrl}
              alt={safeProfile.name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full border border-[var(--bn-border-strong)] object-cover"
            />
            <div>
              <h3 className="text-sm font-semibold text-[var(--bn-text-strong)]">
                Perfil local y respaldo
              </h3>
              <p className="text-[11px] text-[var(--bn-text-muted)]">
                Almacenamiento en el navegador mediante localStorage y archivos JSON
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh] text-xs">
          {savedNotice && (
            <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-success)]/40 text-[var(--bn-success)] rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* Profile Form */}
          <form onSubmit={handleSaveProfile} className="space-y-3 p-4 bg-[var(--bn-surface-alt)] rounded-xl border border-[var(--bn-border)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--bn-text-muted)] mb-1">
                  Nombre del perfil
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-lg px-3 py-1.5 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--bn-text-muted)] mb-1">
                  Correo de referencia
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border-strong)] rounded-lg px-3 py-1.5 text-xs text-[var(--bn-text-strong)] focus:outline-none focus:border-[var(--bn-accent)]"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-xs font-medium transition-colors"
              >
                Guardar perfil
              </button>
            </div>
          </form>

          {/* Local Data Summary */}
          <div>
            <h4 className="text-[11px] font-semibold text-[var(--bn-text-muted)] mb-2.5 uppercase tracking-wider">
              Datos reales guardados en este equipo
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl flex items-center gap-2.5">
                <Bookmark className="w-4 h-4 text-[var(--bn-accent)] shrink-0" />
                <div>
                  <div className="font-semibold text-[var(--bn-text-strong)] tabular-nums">{bookmarksCount} marcadores</div>
                  <div className="text-[11px] text-[var(--bn-text-muted)]">Guardados localmente</div>
                </div>
              </div>
              <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl flex items-center gap-2.5">
                <History className="w-4 h-4 text-[var(--bn-info)] shrink-0" />
                <div>
                  <div className="font-semibold text-[var(--bn-text-strong)] tabular-nums">{historyCount} visitas</div>
                  <div className="text-[11px] text-[var(--bn-text-muted)]">Historial real de sesión</div>
                </div>
              </div>
              <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl flex items-center gap-2.5">
                <Files className="w-4 h-4 text-[var(--bn-success)] shrink-0" />
                <div>
                  <div className="font-semibold text-[var(--bn-text-strong)] tabular-nums">{openTabsCount} pestañas</div>
                  <div className="text-[11px] text-[var(--bn-text-muted)]">Abiertas ahora</div>
                </div>
              </div>
              <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-[var(--bn-warning)] shrink-0" />
                <div>
                  <div className="font-semibold text-[var(--bn-text-strong)] tabular-nums">{topSitesCount} accesos</div>
                  <div className="text-[11px] text-[var(--bn-text-muted)]">En Nueva pestaña</div>
                </div>
              </div>
            </div>
          </div>

          {/* Real JSON Export / Import */}
          <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold text-[var(--bn-text-strong)]">
                  Copia de seguridad portátil (.json)
                </h4>
                <p className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                  Última exportación: {lastExportText}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onExportBackup();
                  setSavedNotice('Archivo JSON de respaldo descargado.');
                  setTimeout(() => setSavedNotice(null), 2500);
                }}
                className="flex-1 py-2 px-3.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar respaldo JSON</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2 px-3.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)] font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar respaldo JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[var(--bn-toolbar)] border-t border-[var(--bn-border)] flex items-center justify-between text-[11px] text-[var(--bn-text-muted)]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--bn-success)]" />
            <span>Sin servidores externos ni dispositivos inventados</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--bn-surface)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] text-[var(--bn-text-strong)] rounded-full text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
