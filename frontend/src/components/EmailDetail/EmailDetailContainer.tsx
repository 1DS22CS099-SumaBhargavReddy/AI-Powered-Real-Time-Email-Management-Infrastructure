import React, { useState } from 'react';
import { Email, suggestReply, setCategory } from '../../services/api.service';
import { Sparkles, Copy, Check, Send, Bot, FileText, ArrowRight, ShieldCheck } from 'lucide-react';

interface EmailDetailProps {
  email: Email | null;
  onUpdateEmail: (updated: Email) => void;
}

export const EmailDetailContainer: React.FC<EmailDetailProps> = ({ email, onUpdateEmail }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [selectedReplyType, setSelectedReplyType] = useState<'professional' | 'friendly' | 'short'>('professional');

  if (!email) {
    return (
      <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <Bot className="w-12 h-12 mb-3 text-indigo-400/40 animate-pulse" />
        <h3 className="text-base font-semibold text-slate-300">Select an email to view details</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Browse your unified inbox, inspect AI categories, view Gemini summaries, or generate grounded RAG replies.
        </p>
      </div>
    );
  }

  const handleGenerateReply = async () => {
    setIsGenerating(true);
    try {
      const data = await suggestReply(email.id);
      onUpdateEmail({
        ...email,
        replies: data.replies
      });
      if (data.replies && data.replies.length > 0) {
        setReplyText(data.replies[0].suggestion);
      }
    } catch (e) {
      console.error('Failed to generate reply', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCategoryChange = async (cat: string) => {
    try {
      const updated = await setCategory(email.id, cat);
      onUpdateEmail(updated);
    } catch (e) {
      console.error('Failed to update category', e);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categories = [
    'INTERESTED', 'MEETING_BOOKED', 'NOT_INTERESTED', 'SPAM', 'OUT_OF_OFFICE', 'UNCATEGORIZED'
  ];

  return (
    <div className="flex-1 bg-slate-900 flex flex-col overflow-y-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-bold text-white tracking-tight">{email.subject}</h2>

          {/* AI Category Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  email.category === cat
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Sender Info */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div>
            <span className="font-semibold text-slate-200">{email.sender}</span>
            {email.senderEmail && <span className="ml-1 text-slate-500 font-mono">&lt;{email.senderEmail}&gt;</span>}
            <span className="ml-2 text-slate-500">to {email.receiver}</span>
          </div>
          <span className="font-mono text-slate-500">
            {new Date(email.receivedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* AI Key Summary Block */}
      {email.summary && (
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Gemini AI Key Summary</span>
            </div>
            {email.confidenceScore > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Confidence: {(email.confidenceScore * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
          <p className="text-xs text-indigo-200 leading-relaxed font-sans">{email.summary}</p>
        </div>
      )}

      {/* Body Content */}
      <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 p-5 text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
        {email.bodyText}
      </div>

      {/* RAG AI Reply Generator Section */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">RAG Reply Suggestion Engine</h4>
          </div>

          <button
            onClick={handleGenerateReply}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Retrieving Context & Generating...' : 'Generate AI Suggestions'}</span>
          </button>
        </div>

        {/* Reply Cards */}
        {email.replies && email.replies.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {email.replies.map((rep) => (
              <div
                key={rep.id}
                onClick={() => {
                  setReplyText(rep.suggestion);
                  setSelectedReplyType(rep.type as any);
                }}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  replyText === rep.suggestion
                    ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="uppercase font-bold text-[10px] text-indigo-400 tracking-wider">
                    {rep.type}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(rep.suggestion, rep.id);
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {copiedId === rep.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-4 leading-relaxed font-sans">{rep.suggestion}</p>
              </div>
            ))}
          </div>
        )}

        {/* Editable Reply Composer */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-slate-400">Edit & Send Response:</p>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Select a reply suggestion above or compose your custom response..."
            rows={4}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans"
          />
          <div className="flex justify-end">
            <button
              onClick={() => alert('Reply draft saved and ready to send via IMAP client.')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Reply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
