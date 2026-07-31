import Taro from '@tarojs/taro';

import { apiGet } from './api';
import { getToken, onAuthChanged } from './auth';

type ContractSignedSubmissionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';
type ContractStatus = 'WAIT_UPLOAD' | 'WAIT_CONFIRM' | 'AVAILABLE';

type ContractItem = {
  status?: ContractStatus | null;
  latestSignedSubmission?: { status?: ContractSignedSubmissionStatus | null } | null;
};

type PagedContract = {
  items?: ContractItem[];
};

type ConversationSummary = {
  unreadCount?: number | null;
};

type PagedConversationSummary = {
  items?: ConversationSummary[];
};

export type ClientBadgeState = {
  hasUnsignedContracts: boolean;
  hasUnreadMessages: boolean;
};

const CLIENT_BADGES_CHANGED_EVENT = 'client:badges:changed';
const MESSAGE_TAB_INDEX = 3;
const BADGE_PAGE_SIZE = 50;
const EMPTY_BADGE_STATE: ClientBadgeState = {
  hasUnsignedContracts: false,
  hasUnreadMessages: false,
};

let lastState: ClientBadgeState = EMPTY_BADGE_STATE;
let inFlight: Promise<ClientBadgeState> | null = null;

function isUnsignedContract(item?: ContractItem | null): boolean {
  if (item?.status !== 'WAIT_CONFIRM') return false;
  const submissionStatus = item.latestSignedSubmission?.status ?? null;
  return !submissionStatus || submissionStatus === 'REJECTED' || submissionStatus === 'SUPERSEDED';
}

function hasUnreadConversation(item?: ConversationSummary | null): boolean {
  return Number(item?.unreadCount || 0) > 0;
}

function sameBadgeState(a: ClientBadgeState, b: ClientBadgeState): boolean {
  return a.hasUnsignedContracts === b.hasUnsignedContracts && a.hasUnreadMessages === b.hasUnreadMessages;
}

function emitBadgeState(state: ClientBadgeState) {
  try {
    Taro.eventCenter.trigger(CLIENT_BADGES_CHANGED_EVENT, state);
  } catch {
    // ignore event bridge failures
  }
}

function updateMessageTabRedDot(hasUnreadMessages: boolean) {
  try {
    if (hasUnreadMessages) {
      Taro.showTabBarRedDot({ index: MESSAGE_TAB_INDEX });
    } else {
      Taro.hideTabBarRedDot({ index: MESSAGE_TAB_INDEX });
    }
  } catch {
    // Some runtimes or non-tab pages do not expose tabBar APIs.
  }
}

function setBadgeState(next: ClientBadgeState): ClientBadgeState {
  updateMessageTabRedDot(next.hasUnreadMessages);
  if (sameBadgeState(lastState, next)) return lastState;
  lastState = next;
  emitBadgeState(next);
  return next;
}

export function getClientBadgeState(): ClientBadgeState {
  return lastState;
}

export function onClientBadgesChanged(handler: (state: ClientBadgeState) => void) {
  try {
    Taro.eventCenter.on(CLIENT_BADGES_CHANGED_EVENT, handler);
  } catch {
    // ignore event bridge failures
  }
  return () => {
    try {
      Taro.eventCenter.off(CLIENT_BADGES_CHANGED_EVENT, handler);
    } catch {
      // ignore event bridge failures
    }
  };
}

export function clearClientBadges(): ClientBadgeState {
  inFlight = null;
  return setBadgeState(EMPTY_BADGE_STATE);
}

async function loadUnsignedContractBadge(): Promise<boolean> {
  const data = await apiGet<PagedContract>('/contracts', {
    status: 'WAIT_CONFIRM',
    page: 1,
    pageSize: BADGE_PAGE_SIZE,
  });
  return (data.items || []).some(isUnsignedContract);
}

async function loadUnreadMessageBadge(): Promise<boolean> {
  const data = await apiGet<PagedConversationSummary>('/me/conversations', {
    page: 1,
    pageSize: BADGE_PAGE_SIZE,
  });
  return (data.items || []).some(hasUnreadConversation);
}

export async function refreshClientBadges(): Promise<ClientBadgeState> {
  if (!getToken()) {
    return clearClientBadges();
  }

  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [contractResult, messageResult] = await Promise.allSettled([
      loadUnsignedContractBadge(),
      loadUnreadMessageBadge(),
    ]);
    const next = {
      hasUnsignedContracts:
        contractResult.status === 'fulfilled' ? contractResult.value : lastState.hasUnsignedContracts,
      hasUnreadMessages:
        messageResult.status === 'fulfilled' ? messageResult.value : lastState.hasUnreadMessages,
    };
    return setBadgeState(next);
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function installClientBadgeSync() {
  void refreshClientBadges();
  const offAuthChanged = onAuthChanged(() => {
    if (getToken()) {
      void refreshClientBadges();
    } else {
      clearClientBadges();
    }
  });

  return () => {
    offAuthChanged();
  };
}
