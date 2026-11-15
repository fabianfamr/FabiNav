import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  Bookmark,
  History,
  Files,
  Globe,
  ShieldCheck,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { GoogleUserProfile, LocalBackupMeta } from '../types';
import { INITIAL_BACKUP_META } from '../constants/initialData';

interface GoogleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: GoogleUserProfile | null;
  isAuthLoading: boolean;
  authError: string | null;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  backupMeta?: LocalBackupMeta;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  historyCount?: number;
  bookmarksCount?: number;
  openTabsCount?: number;
  topSitesCount?: number;
}

const LEO_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const GoogleSyncModal: React.FC<GoogleSyncModalProps> = ({
  isOpen,
  onClose,
  googleUser,
  isAuthLoading,
  authError,
  onGoogleSignIn,
  onGoogleSignOut,
  backupMeta,
  onExportBackup,
  onImportBackup,
  historyCount = 0,
  bookmarksCount = 0,
  openTabsCount = 0,
  topSitesCount = 0
}) => {
  const safeMeta = backupMeta || INITIAL_BACKUP_META;
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportBackup(file);
    setNotice('Respaldo JSON importado correctamente.');
    setTimeout(() => setNotice(null), 2500);
    e.target.value = '';
  };

  const lastExportText = safeMeta.lastExportTimestamp
    ? new Date(safeMeta.lastExportTimestamp).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Aún no se ha exportado';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: LEO_EASE_OUT }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={onClose}
        >
          <motion.div
            id="google-account-backup-modal"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: LEO_EASE_OUT }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--bn-text)]"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                {googleUser?.photoUrl ? (
                  <img
                    src={googleUser.photoUrl}
                    alt={googleUser.displayName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-[var(--bn-border-strong)] shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center font-semibold text-sm shrink-0">
                    {googleUser ? googleUser.displayName[0]?.toUpperCase() || 'G' : 'G'}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--bn-text-strong)]">
                    Cuenta de Google y respaldo local
                  </h3>
                  <p className="text-[11px] text-[var(--bn-text-muted)]">
                    {googleUser
                      ? `Conectado como ${googleUser.email || googleUser.displayName}`
                      : 'Conecta tu cuenta de Google para obtener tu foto de perfil real'}
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
              {notice && (
                <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-success)]/40 text-[var(--bn-success)] rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              {authError && (
                <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-danger)]/40 text-[var(--bn-danger)] rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Real Google Account Sign-In Card */}
              <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-2xl">
                {googleUser ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {googleUser.photoUrl ? (
                        <img
                          src={googleUser.photoUrl}
                          alt={googleUser.displayName}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border border-[var(--bn-border-strong)] shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[var(--bn-accent)] text-white flex items-center justify-center font-bold text-base shrink-0">
                          {googleUser.displayName[0]?.toUpperCase() || 'G'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--bn-text-strong)] truncate">
                          {googleUser.displayName}
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] truncate">
                          {googleUser.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onGoogleSignOut}
                      className="px-3.5 py-1.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-xs font-medium text-[var(--bn-text-strong)] flex items-center gap-1.5 shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--bn-text-strong)]">
                        Foto y perfil desde Google
                      </h4>
                      <p className="text-[11px] text-[var(--bn-text-muted)] mt-0.5 leading-relaxed">
                        Inicia sesión con tu cuenta real de Google para mostrar tu foto oficial en la barra del navegador.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isAuthLoading}
                      onClick={onGoogleSignIn}
                      className="gsi-material-button shrink-0 disabled:opacity-60 inline-flex items-center justify-center gap-2.5 px-4 py-2 rounded-full bg-white text-[#1f1f1f] hover:bg-[#f1f3f4] active:scale-95 border border-[#747775]/40 font-medium text-xs shadow-sm transition-all"
                    >
                      <span className="w-4 h-4 shrink-0">
                        <svg viewBox="0 0 48 48" className="w-full h-full block">
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                        </svg>
                      </span>
                      <span>{isAuthLoading ? 'Conectando...' : 'Sign in with Google'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Local Data Summary */}
              <div>
                <h4 className="text-[11px] font-semibold text-[var(--bn-text-muted)] mb-2.5 uppercase tracking-wider">
                  Datos guardados en este dispositivo
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl flex items-center gap-2.5">
                    <Bookmark className="w-4 h-4 text-[var(--bn-accent)] shrink-0" />
                    <div>
                      <div className="font-semibold text-[var(--bn-text-strong)] tabular-nums">
                        {bookmarksCount} marcadores
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">Guardados localmente</div>
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl flex items-center gap-2.5">
                    <History className="w-4 h-4 text-[var(--bn-info)] shrink-0" />
                    <div>
                      <div className="font-semibold text-[var(--bn-text-strong)] tabular-nums">
                        {historyCount} visitas
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">Historial de sesión</div>
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl flex items-center gap-2.5">
                    <Files className="w-4 h-4 text-[var(--bn-success)] shrink-0" />
                    <div>
                      <div className="font-semibold text-[var(--bn-text-strong)] tabular-nums">
                        {openTabsCount} pestañas
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">Abiertas ahora</div>
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-[var(--bn-warning)] shrink-0" />
                    <div>
                      <div className="font-semibold text-[var(--bn-text-strong)] tabular-nums">
                        {topSitesCount} accesos
                      </div>
                      <div className="text-[11px] text-[var(--bn-text-muted)]">En Nueva pestaña</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real JSON Export / Import */}
              <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-[var(--bn-text-strong)]">
                    Copia de seguridad portátil (.json)
                  </h4>
                  <p className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
                    Última exportación: {lastExportText}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onExportBackup();
                      setNotice('Archivo JSON de respaldo descargado.');
                      setTimeout(() => setNotice(null), 2500);
                    }}
                    className="flex-1 py-2 px-3.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] active:scale-95 text-white font-medium flex items-center justify-center gap-2 transition-all"
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
                    className="flex-1 py-2 px-3.5 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] active:scale-95 border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)] font-medium flex items-center justify-center gap-2 transition-all"
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
                <span>Autenticación oficial de Google y respaldo local</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-[var(--bn-surface)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] text-[var(--bn-text-strong)] rounded-full text-xs font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
