import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { X, Download, Copy, Check, QrCode } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  url: string;
  title: string;
  onClose: () => void;
  onRecordDownload?: (filename: string, fileSize: string, url: string) => void;
}

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  url,
  title,
  onClose,
  onRecordDownload
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !url) return;
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: {
        dark: '#111318',
        light: '#ffffff'
      }
    })
      .then((res) => setDataUrl(res))
      .catch(() => setDataUrl(null));
  }, [isOpen, url]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const filename = `fabinav-qr-${Date.now()}.png`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
    if (onRecordDownload) {
      onRecordDownload(filename, '6.4 KB', url);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: FABI_EASE_OUT }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl p-5 shadow-2xl text-[var(--bn-text)] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--bn-border)] pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--bn-text-strong)]">
                <QrCode className="w-4 h-4 text-[var(--bn-accent)]" />
                <span>Código QR de la página</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center space-y-3">
              <div className="p-3 bg-white rounded-2xl shadow-md">
                {dataUrl ? (
                  <img src={dataUrl} alt={`QR de ${title}`} className="w-48 h-48 block" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-neutral-500">
                    Generando código QR...
                  </div>
                )}
              </div>

              <div className="w-full text-center space-y-1">
                <div className="text-xs font-medium text-[var(--bn-text-strong)] truncate">
                  {title || 'Página actual'}
                </div>
                <div className="text-[11px] font-mono text-[var(--bn-text-muted)] truncate bg-[var(--bn-omnibox)] px-3 py-1.5 rounded-xl border border-[var(--bn-border)]">
                  {url}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex-1 py-2 px-3 rounded-full bg-[var(--bn-toolbar)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-xs font-medium text-[var(--bn-text-strong)] flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[var(--bn-success-text)]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar vínculo'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!dataUrl}
                className="flex-1 py-2 px-3 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] disabled:opacity-45 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PNG</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
