import React from 'react';
import { motion } from 'motion/react';
import {
  Bookmark,
  History,
  Download,
  StickyNote,
  MessageCircle,
  MessageSquare,
  Send,
  Terminal,
  Settings
} from 'lucide-react';
import { SidebarPanelView } from '../types';

interface ActivityBarProps {
  activeView: SidebarPanelView;
  onSelectView: (view: SidebarPanelView) => void;
  onOpenSettings: () => void;
  position: 'left' | 'right';
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onSelectView,
  onOpenSettings,
  position
}) => {
  const items: Array<{
    id: Exclude<SidebarPanelView, null>;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color?: string;
  }> = [
    { id: 'bookmarks', icon: Bookmark, label: 'Marcadores' },
    { id: 'history', icon: History, label: 'Historial' },
    { id: 'downloads', icon: Download, label: 'Descargas' },
    { id: 'notes', icon: StickyNote, label: 'Notas de sesión' },
    { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp Web', color: 'text-[#25D366]' },
    { id: 'discord', icon: MessageSquare, label: 'Discord', color: 'text-[#5865F2]' },
    { id: 'telegram', icon: Send, label: 'Telegram Web', color: 'text-[#229ED9]' },
    { id: 'devtools', icon: Terminal, label: 'Herramientas para desarrolladores' }
  ];

  return (
    <aside
      id="fabinav-sidebar-strip"
      className={`w-11 bg-[var(--bn-toolbar)] ${
        position === 'right' ? 'border-l' : 'border-r'
      } border-[var(--bn-border)] flex flex-col justify-between items-center py-2 select-none z-30 shrink-0`}
      aria-label="Barra lateral de FabiNav"
    >
      <div className="flex flex-col items-center gap-1.5 w-full px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(isActive ? null : item.id)}
              title={item.label}
              className={`relative w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all fabi-transition-xs ${
                isActive
                  ? 'text-[var(--bn-accent)]'
                  : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="fabinav-sidebar-pill"
                  transition={{ duration: 0.18, ease: [0, 0, 0.58, 1] }}
                  className="absolute inset-0 rounded-lg bg-[var(--bn-accent-soft)]"
                />
              )}
              <Icon
                className={`relative z-10 w-4 h-4 ${
                  isActive && item.color ? item.color : ''
                }`}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        title="Configuración de la barra lateral"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] active:scale-90 transition-all fabi-transition-xs"
      >
        <Settings className="w-4 h-4" />
      </button>
    </aside>
  );
};
