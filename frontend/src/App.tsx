import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Navigation/Sidebar';
import { Header } from './components/Header/Header';
import { EmailListContainer } from './components/EmailList/EmailListContainer';
import { EmailDetailContainer } from './components/EmailDetail/EmailDetailContainer';
import { AccountConnectModal } from './components/AccountModal/AccountConnectModal';
import {
  Email,
  EmailAccount,
  fetchEmails,
  searchEmails,
  fetchEmailById,
  fetchAccounts
} from './services/api.service';
import { io } from 'socket.io-client';

export const App: React.FC = () => {
  const [category, setCategory] = useState<string>('ALL');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [stats, setStats] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      let emailList: Email[] = [];
      if (searchQuery.trim() !== '') {
        const data = await searchEmails(searchQuery, category);
        emailList = data?.emails || [];
      } else {
        const data = await fetchEmails(category, selectedAccountId || undefined);
        emailList = data?.emails || [];
      }

      setEmails(emailList);
      if (emailList.length > 0 && !selectedEmail) {
        setSelectedEmail(emailList[0]);
      }

      // Compute statistics by category
      const catStats: Record<string, number> = {};
      emailList.forEach((e) => {
        catStats[e.category] = (catStats[e.category] || 0) + 1;
      });
      catStats['ALL'] = emailList.length;
      setStats(catStats);

      const accs = await fetchAccounts();
      setAccounts(accs || []);
    } catch (err) {
      console.error('Failed to load email data', err);
    } finally {
      setIsLoading(false);
    }
  }, [category, selectedAccountId, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Socket.io Real-Time Event Listener
  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: localStorage.getItem('token') || undefined
      }
    });

    const handleNewEmail = (newEmail: Email) => {
      setEmails((prev) => [newEmail, ...prev]);
    };

    const handleEmailUpdated = (updatedEmail: Email) => {
      setEmails((prev) => prev.map((e) => (e.id === updatedEmail.id ? updatedEmail : e)));
      setSelectedEmail((prev) => (prev?.id === updatedEmail.id ? updatedEmail : prev));
    };

    socket.on('newEmailSync', handleNewEmail);
    socket.on('emailUpdated', handleEmailUpdated);

    return () => {
      socket.off('newEmailSync', handleNewEmail);
      socket.off('emailUpdated', handleEmailUpdated);
      socket.disconnect();
    };
  }, []);

  // Keyboard Shortcuts (J / K / R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }

      if (e.key === 'j' || e.key === 'J') {
        // Move to next email
        const currentIndex = emails.findIndex((e) => e.id === selectedEmail?.id);
        if (currentIndex < emails.length - 1) {
          setSelectedEmail(emails[currentIndex + 1]);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        // Move to previous email
        const currentIndex = emails.findIndex((e) => e.id === selectedEmail?.id);
        if (currentIndex > 0) {
          setSelectedEmail(emails[currentIndex - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [emails, selectedEmail]);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentCategory={category}
        onSelectCategory={setCategory}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        stats={stats}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={loadData}
          isRefreshing={isLoading}
          totalEmails={emails.length}
        />

        <div className="flex-1 flex min-h-0">
          <EmailListContainer
            emails={emails}
            selectedEmailId={selectedEmail?.id || null}
            onSelectEmail={async (id) => {
              const full = await fetchEmailById(id);
              setSelectedEmail(full);
            }}
            isLoading={isLoading}
          />

          <EmailDetailContainer
            email={selectedEmail}
            onUpdateEmail={(updated) => {
              setSelectedEmail(updated);
              setEmails((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            }}
          />
        </div>
      </div>

      {/* Account Connection Modal */}
      <AccountConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};

export default App;
