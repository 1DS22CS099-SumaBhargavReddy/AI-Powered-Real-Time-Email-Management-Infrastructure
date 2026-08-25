import React from 'react';
import { Inbox, CheckCircle2, CalendarCheck, Ban, AlertOctagon, HelpCircle, Mail, Plus, Wifi } from 'lucide-react';
import { EmailAccount } from '../../services/api.service';

interface SidebarProps {
  currentCategory: string;
  onSelectCategory: (cat: string) => void;
  accounts: EmailAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (id: string | null) => void;
  onOpenConnectModal: () => void;
  stats: Record<string, number>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentCategory,
  onSelectCategory,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onOpenConnectModal,
  stats
}) => {
  const categories = [
    { id: 'ALL', label: 'All Mail', icon: Inbox },
    { id: 'INTERESTED', label: 'Interested', icon: CheckCircle2, color: 'text-emerald-400' },
    { id: 'MEETING_BOOKED', label: 'Meeting Booked', icon: CalendarCheck, color: 'text-cyan-400' },
    { id: 'NOT_INTERESTED', label: 'Not Interested', icon: Ban, color: 'text-rose-400' },
    { id: 'SPAM', label: 'Spam', icon: AlertOctagon, color: 'text-amber-400' },
    { id: 'OUT_OF_OFFICE', label: 'Out of Office', icon: Mail, color: 'text-purple-400' },
    { id: 'UNCATEGORIZED', label: 'Uncategorized', icon: HelpCircle, color: 'text-slate-400' }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 select-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            EP
          </div>
          <div>
            <h1 className="font-bold text-white text-sm tracking-wide">AI Email Platform</h1>
            <p className="text-[10px] text-indigo-400 font-mono">Infra v2.0</p>
          </div>
        </div>

        {/* Categories List */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Categories</p>
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = currentCategory === cat.id;
            const count = stats[cat.id] || 0;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${cat.color || 'text-slate-400'}`} />
                  <span>{cat.label}</span>
                </div>
                {count > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                    isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Connected Accounts */}
        <div className="mt-8">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Accounts</p>
            <button
              onClick={onOpenConnectModal}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition"
              title="Connect Account"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => onSelectAccount(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                selectedAccountId === null ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <Wifi className="w-3.5 h-3.5 text-indigo-400" />
              <span>All Accounts</span>
            </button>

            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => onSelectAccount(acc.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium truncate ${
                  selectedAccountId === acc.id ? 'bg-slate-800 text-indigo-300' : 'text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-2 h-2 rounded-full ${acc.syncStatus === 'CONNECTED' || acc.syncStatus === 'IDLE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="truncate">{acc.email}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Keyboard Hint */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 text-[11px] text-slate-400 space-y-1 font-mono">
        <p className="text-[10px] uppercase font-bold text-indigo-400">Shortcuts</p>
        <div className="flex justify-between"><span>Next / Prev</span><span className="text-white">J / K</span></div>
        <div className="flex justify-between"><span>Suggest Reply</span><span className="text-white">R</span></div>
      </div>
    </aside>
  );
};
