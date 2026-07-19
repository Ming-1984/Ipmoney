import { ArrowRightOutlined } from '@ant-design/icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

export type LiveNoticeKind = 'order' | 'conversation' | 'badge';

export type LiveNotice = {
  id: string;
  kind: LiveNoticeKind;
  title: string;
  summary: string;
  href: string;
  createdAt: string;
  icon: React.ReactNode;
};

type LiveNoticeContextValue = {
  notices: LiveNotice[];
  pushNotices: (nextNotices: LiveNotice[]) => void;
  dismissNotice: (noticeId: string) => void;
};

const LiveNoticeContext = createContext<LiveNoticeContextValue | null>(null);
const LIVE_NOTICE_LIMIT = 5;
const LIVE_NOTICE_TTL_MS = 8000;

function useLiveNoticeContext() {
  const value = useContext(LiveNoticeContext);
  if (!value) {
    throw new Error('LiveNoticeContext is missing');
  }
  return value;
}

export function useLiveNoticePush() {
  return useLiveNoticeContext().pushNotices;
}

function LiveNoticeStackView() {
  const { notices, dismissNotice } = useLiveNoticeContext();
  const navigate = useNavigate();

  if (notices.length === 0) return null;

  return (
    <div className="ipm-showcase-toast-stack" aria-live="polite" aria-atomic="false">
      {notices.map((notice) => (
        <button
          key={notice.id}
          type="button"
          className={`ipm-showcase-toast ipm-showcase-toast-${notice.kind}`}
          onClick={() => {
            dismissNotice(notice.id);
            navigate(notice.href);
          }}
        >
          <span className={`ipm-showcase-toast-icon ipm-showcase-toast-icon-${notice.kind}`}>{notice.icon}</span>
          <span className="ipm-showcase-toast-content">
            <strong>{notice.title}</strong>
            <span>{notice.summary}</span>
          </span>
          <span className="ipm-showcase-toast-arrow" aria-hidden="true">
            <ArrowRightOutlined />
          </span>
        </button>
      ))}
    </div>
  );
}

function getFullscreenTarget(): Element | null {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement;
}

function LiveNoticeStackPortal() {
  const [fullscreenTarget, setFullscreenTarget] = useState<Element | null>(() => getFullscreenTarget());
  const stack = <LiveNoticeStackView />;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const syncFullscreenTarget = () => {
      setFullscreenTarget(document.fullscreenElement);
    };

    syncFullscreenTarget();
    document.addEventListener('fullscreenchange', syncFullscreenTarget);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenTarget);
  }, []);

  return fullscreenTarget ? createPortal(stack, fullscreenTarget) : stack;
}

export function LiveNoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<LiveNotice[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissNotice = useCallback((noticeId: string) => {
    const timer = timersRef.current.get(noticeId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(noticeId);
    }
    setNotices((current) => current.filter((item) => item.id !== noticeId));
  }, []);

  const pushNotices = useCallback(
    (nextNotices: LiveNotice[]) => {
      if (nextNotices.length === 0) return;
      const dedupedIncoming = Array.from(new Map(nextNotices.map((item) => [item.id, item])).values());

      setNotices((current) => {
        const currentIds = new Set(current.map((item) => item.id));
        const merged = [...current, ...dedupedIncoming.filter((item) => !currentIds.has(item.id))];
        if (merged.length <= LIVE_NOTICE_LIMIT) return merged;

        const removed = merged.slice(0, merged.length - LIVE_NOTICE_LIMIT);
        for (const item of removed) {
          const timer = timersRef.current.get(item.id);
          if (timer !== undefined) {
            window.clearTimeout(timer);
            timersRef.current.delete(item.id);
          }
        }
        return merged.slice(-LIVE_NOTICE_LIMIT);
      });

      for (const notice of dedupedIncoming) {
        if (timersRef.current.has(notice.id)) continue;
        const timer = window.setTimeout(() => {
          timersRef.current.delete(notice.id);
          setNotices((current) => current.filter((item) => item.id !== notice.id));
        }, LIVE_NOTICE_TTL_MS);
        timersRef.current.set(notice.id, timer);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      notices,
      pushNotices,
      dismissNotice,
    }),
    [dismissNotice, notices, pushNotices],
  );

  return (
    <LiveNoticeContext.Provider value={value}>
      {children}
      <LiveNoticeStackPortal />
    </LiveNoticeContext.Provider>
  );
}
