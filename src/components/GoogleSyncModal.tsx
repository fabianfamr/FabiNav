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
  HardDrive
} from 'lucide-react';
import { LocalBackupMeta } from '../types';
import { INITIAL_BACKUP_META } from '../constants/initialData';

interface GoogleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
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
            id="local-backup-modal"
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
                <div className="w-9 h-9 rounded-xl bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center shrink-0">
                  <HardDrive className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--bn-text-strong)]">
                    Datos locales y respaldo
                  </h3>
                  <p className="text-[11px] text-[var(--bn-text-muted)]">
                    Navegación sin cuentas ni inicio de sesión · Guardado local en tu equipo
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

              {/* Local Data Summary */}
              <div>
                <h4 className="text-[11px] font-semibold text-[var(--bn-text-muted)] mb-2.5 uppercase tracking-wider">
                  Datos reales guardados en este dispositivo
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
                <span>Sin cuentas externas ni inicio de sesión simulado</span>
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
