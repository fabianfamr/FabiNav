import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Laptop, Copy, Check, Download, Terminal, Code2 } from 'lucide-react';
import { ELECTRON_BOILERPLATE, APP_VERSION } from '../constants/initialData';

interface ElectronExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordDownload?: (filename: string, size: string, url: string) => void;
}

const LEO_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const ElectronExportModal: React.FC<ElectronExportModalProps> = ({
  isOpen,
  onClose,
  onRecordDownload
}) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'main' | 'preload' | 'package'>('guide');
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const data = {
      name: 'FabiNav Desktop',
      version: APP_VERSION,
      files: ELECTRON_BOILERPLATE,
      instructions: [
        '1. Guardar los archivos en una carpeta de proyecto dedicada',
        '2. Ejecutar: npm install',
        '3. Ejecutar: npm run start para iniciar el entorno de escritorio',
        '4. Ejecutar: npm run build:win para generar el instalador en Windows'
      ]
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabinav-electron-v${APP_VERSION}.json`;
    a.click();
    URL.revokeObjectURL(url);

    if (onRecordDownload) {
      onRecordDownload(
        `fabinav-electron-v${APP_VERSION}.json`,
        `${(jsonString.length / 1024).toFixed(1)} KB`,
        `fabinav://export/electron-v${APP_VERSION}.json`
      );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="fabinav-electron-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: LEO_EASE_OUT }}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            id="fabinav-electron-modal"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: LEO_EASE_OUT }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[var(--bn-text)]"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] border border-[var(--bn-border)]">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--bn-text-strong)] flex items-center gap-2">
                    <span>Exportación a Electron para Escritorio</span>
                    <span className="text-[11px] font-mono text-[var(--bn-text-muted)] tabular-nums">
                      v{APP_VERSION}
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--bn-text-muted)]">
                    Genera los archivos de configuración necesarios para empaquetar FabiNav en Windows, macOS o Linux.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab switcher */}
            <div className="px-6 pt-2 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex gap-4 overflow-x-auto no-scrollbar">
              {(['guide', 'main', 'preload', 'package'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap shrink-0 ${
                    activeTab === tab
                      ? 'border-[var(--bn-accent)] text-[var(--bn-text-strong)]'
                      : 'border-transparent text-[var(--bn-text-muted)] hover:text-[var(--bn-text)]'
                  }`}
                >
                  {tab === 'guide' && 'Guía de compilación'}
                  {tab === 'main' && 'main.js'}
                  {tab === 'preload' && 'preload.js'}
                  {tab === 'package' && 'package.json'}
                </button>
              ))}
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-6 text-xs space-y-4">
              {activeTab === 'guide' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl space-y-1.5">
                    <h4 className="font-semibold text-[var(--bn-text-strong)] text-sm">
                      Empaquetado nativo con aislamiento de contexto
                    </h4>
                    <p className="text-xs text-[var(--bn-text-muted)] leading-relaxed">
                      La plantilla incluye configuración con <code className="font-mono text-[var(--bn-text-strong)]">contextIsolation: true</code>, <code className="font-mono text-[var(--bn-text-strong)]">sandbox: true</code> y filtrado básico de solicitudes de rastreo desde el proceso principal de Electron.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-[var(--bn-text-strong)] font-semibold text-xs">
                        <Terminal className="w-4 h-4 text-[var(--bn-accent)]" />
                        <span>1. Instalar dependencias</span>
                      </div>
                      <code className="block p-2 bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-lg text-[11px] font-mono text-[var(--bn-text)]">
                        npm install -D electron electron-builder
                      </code>
                    </div>

                    <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-[var(--bn-text-strong)] font-semibold text-xs">
                        <Code2 className="w-4 h-4 text-[var(--bn-info)]" />
                        <span>2. Ejecutar en local</span>
                      </div>
                      <code className="block p-2 bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-lg text-[11px] font-mono text-[var(--bn-text)]">
                        npm run start
                      </code>
                    </div>

                    <div className="p-3 bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-[var(--bn-text-strong)] font-semibold text-xs">
                        <Laptop className="w-4 h-4 text-[var(--bn-success)]" />
                        <span>3. Compilar instalador</span>
                      </div>
                      <code className="block p-2 bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-lg text-[11px] font-mono text-[var(--bn-text)]">
                        npm run build:win
                      </code>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full py-2.5 px-4 bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] active:scale-[0.99] text-white font-medium rounded-full flex items-center justify-center gap-2 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar paquete de configuración JSON</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'main' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-mono text-[var(--bn-text-muted)]">
                      Proceso principal · main.js
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(ELECTRON_BOILERPLATE.mainJs)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] text-[var(--bn-text-strong)] rounded-full border border-[var(--bn-border)] text-xs"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-[var(--bn-success)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copied ? 'Copiado' : 'Copiar código'}</span>
                    </button>
                  </div>
                  <pre className="p-3.5 bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-xl font-mono text-[11px] text-[var(--bn-text)] overflow-x-auto max-h-80 leading-relaxed">
                    {ELECTRON_BOILERPLATE.mainJs}
                  </pre>
                </div>
              )}

              {activeTab === 'preload' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-mono text-[var(--bn-text-muted)]">
                      Puente seguro · preload.js
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(ELECTRON_BOILERPLATE.preloadJs)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] text-[var(--bn-text-strong)] rounded-full border border-[var(--bn-border)] text-xs"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-[var(--bn-success)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copied ? 'Copiado' : 'Copiar código'}</span>
                    </button>
                  </div>
                  <pre className="p-3.5 bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-xl font-mono text-[11px] text-[var(--bn-text)] overflow-x-auto max-h-80 leading-relaxed">
                    {ELECTRON_BOILERPLATE.preloadJs}
                  </pre>
                </div>
              )}

              {activeTab === 'package' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-mono text-[var(--bn-text-muted)]">
                      Manifiesto · package.json
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(ELECTRON_BOILERPLATE.packageJson)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] text-[var(--bn-text-strong)] rounded-full border border-[var(--bn-border)] text-xs"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-[var(--bn-success)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copied ? 'Copiado' : 'Copiar código'}</span>
                    </button>
                  </div>
                  <pre className="p-3.5 bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-xl font-mono text-[11px] text-[var(--bn-text)] overflow-x-auto max-h-80 leading-relaxed">
                    {ELECTRON_BOILERPLATE.packageJson}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-[var(--bn-toolbar)] border-t border-[var(--bn-border)] flex items-center justify-between text-xs text-[var(--bn-text-muted)]">
              <span className="font-mono text-[11px]">Electron 31+ · FabiNav {APP_VERSION}</span>
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
