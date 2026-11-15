import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CommandItem } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

const LEO_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(search.toLowerCase()) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(search.toLowerCase())) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + (filteredCommands.length || 1)) % (filteredCommands.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="fabinav-command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: LEO_EASE_OUT }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-start justify-center pt-16 p-4"
          onClick={onClose}
        >
          <motion.div
            id="fabinav-command-palette-modal"
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: LEO_EASE_OUT }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center px-3.5 py-3 border-b border-[var(--bn-border)] bg-[var(--bn-toolbar)]">
              <span className="text-[var(--bn-accent)] text-xs font-mono mr-2.5">&gt;</span>
              <input
                ref={inputRef}
                type="text"
                placeholder="Escribir un comando rápido..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[var(--bn-omnibox)] border border-[var(--bn-border)] rounded-full px-3.5 py-1.5 text-xs text-[var(--bn-text-strong)] placeholder-[var(--bn-text-muted)] focus:outline-none focus:border-[var(--bn-accent)]"
              />
            </div>

            <div className="max-h-80 overflow-y-auto p-1.5 flex flex-col">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--bn-text-muted)]">
                  No hay comandos que coincidan con "{search}"
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const isSelected = idx === selectedIndex;

                  return (
                    <div
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer text-xs transition-colors rounded-xl ${
                        isSelected
                          ? 'bg-[var(--bn-active)] text-[var(--bn-text-strong)]'
                          : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
                      }`}
                    >
                      <div className="flex flex-col overflow-hidden mr-3">
                        <span className="font-medium truncate">{cmd.title}</span>
                        {cmd.subtitle && (
                          <span className="text-[11px] truncate text-[var(--bn-text-muted)]">
                            {cmd.subtitle}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-[var(--bn-text-muted)]">{cmd.category}</span>
                        {cmd.shortcut && (
                          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border bg-[var(--bn-surface-alt)] text-[var(--bn-text-strong)] border-[var(--bn-border-strong)]">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2.5 bg-[var(--bn-toolbar)] border-t border-[var(--bn-border)] flex items-center justify-between text-[11px] text-[var(--bn-text-muted)]">
              <div className="flex items-center gap-3 font-mono">
                <span>↑↓ Navegar</span>
                <span>Enter Ejecutar</span>
                <span>Esc Cerrar</span>
              </div>
              <span>Comandos de FabiNav</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
