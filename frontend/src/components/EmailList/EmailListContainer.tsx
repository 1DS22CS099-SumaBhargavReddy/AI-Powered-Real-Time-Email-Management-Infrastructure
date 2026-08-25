import React from 'react';
import { Email } from '../../services/api.service';
import { Sparkles, Clock, CheckCircle2, CalendarCheck, Ban, AlertOctagon, HelpCircle, Mail } from 'lucide-react';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
  isLoading: boolean;
}

const getCategoryBadge = (category: string) => {
  switch (category) {
    case 'INTERESTED':
      return { label: 'Interested', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 };
    case 'MEETING_BOOKED':
      return { label: 'Meeting Booked', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: CalendarCheck };
    case 'NOT_INTERESTED':
      return { label: 'Not Interested', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: Ban };
    case 'SPAM':
      return { label: 'Spam', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertOctagon };
    case 'OUT_OF_OFFICE':
      return { label: 'Out of Office', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Mail };
    default:
      return { label: 'Uncategorized', bg: 'bg-slate-800 text-slate-400 border-slate-700', icon: HelpCircle };
  }
};

export const EmailListContainer: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="w-96 border-r border-slate-800 bg-slate-950 p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-slate-900/60 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="w-96 border-r border-slate-800 bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <Mail className="w-10 h-10 mb-2 opacity-30 text-indigo-400" />
        <p className="text-sm font-medium">No emails found</p>
        <p className="text-xs text-slate-600 mt-1">Connect an IMAP account or adjust your category filter.</p>
      </div>
    );
  }

  return (
    <div className="w-96 border-r border-slate-800 bg-slate-950 flex flex-col overflow-y-auto divide-y divide-slate-800/60">
      {emails.map((email) => {
        const isSelected = email.id === selectedEmailId;
        const badge = getCategoryBadge(email.category);
        const Icon = badge.icon;
        const dateStr = new Date(email.receivedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        return (
          <div
            key={email.id}
            onClick={() => onSelectEmail(email.id)}
            className={`p-4 cursor-pointer transition-all ${
              isSelected
                ? 'bg-indigo-950/40 border-l-4 border-indigo-500'
                : 'hover:bg-slate-900/50 border-l-4 border-transparent'
            }`}
          >
            {/* Sender & Date */}
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                {email.sender}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{dateStr}</span>
            </div>

            {/* Subject */}
            <h3 className="text-xs font-medium text-slate-300 truncate mb-1">{email.subject}</h3>

            {/* Snippet */}
            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2.5">
              {email.snippet || email.bodyText}
            </p>

            {/* AI Category & Confidence Badge */}
            <div className="flex items-center justify-between">
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${badge.bg}`}>
                <Icon className="w-3 h-3" />
                <span>{badge.label}</span>
              </div>

              {email.confidenceScore > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>{(email.confidenceScore * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
