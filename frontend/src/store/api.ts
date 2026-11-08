import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Account, Payment, Plan, UsageEvent, UsageSummary } from '@/lib/billing';
import type { ChatSummary, Page } from '@/lib/chats';
import type { UploadedFile } from '@/lib/uploads';

/**
 * The browser's data layer: every call goes to the app's own /api (the Next.js proxy forwards it
 * to the gateway with the session cookie). Lists are cached and refreshed when a change could
 * have touched them.
 */

const LIST = { type: 'Chat', id: 'LIST' } as const;

export interface UpdateChatArgs {
  id: string;
  title?: string;
  pinned?: boolean;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Chat', 'Account', 'Payment', 'Usage'],
  endpoints: (build) => ({
    /** The sidebar list: pinned chats, then the rest by latest activity, a page at a time. */
    listChats: build.infiniteQuery<Page<ChatSummary>, void, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
      query: ({ pageParam }) =>
        pageParam ? `/chats?cursor=${encodeURIComponent(pageParam)}` : '/chats',
      providesTags: [LIST],
    }),

    searchChats: build.query<Page<ChatSummary>, string>({
      query: (term) => `/chats?query=${encodeURIComponent(term)}`,
      providesTags: [LIST],
    }),

    getChat: build.query<{ chat: ChatSummary }, string>({
      query: (id) => `/chats/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Chat', id }],
    }),

    /** The plan and balance for the credits card. */
    getAccount: build.query<{ account: Account }, void>({
      query: () => '/billing/account',
      providesTags: ['Account'],
    }),

    getPlans: build.query<{ plans: Plan[]; currency: string; testMode: boolean }, void>({
      query: () => '/billing/plans',
    }),

    getPayments: build.query<{ items: Payment[] }, void>({
      query: () => '/billing/payments',
      providesTags: ['Payment'],
    }),

    /** An order priced by the server; the browser only names the plan. */
    createOrder: build.mutation<
      {
        order: { id: string; amountPaise: number; currency: string; planId: string };
        keyId: string;
      },
      { planId: Plan['id'] }
    >({
      query: (body) => ({ url: '/billing/orders', method: 'POST', body }),
      invalidatesTags: ['Payment'],
    }),

    /** The checkout's result, checked by the server before credits are added. */
    verifyPayment: build.mutation<
      { account: Account; granted: boolean },
      { orderId: string; paymentId: string; signature: string }
    >({
      query: ({ orderId, ...body }) => ({
        url: `/billing/orders/${encodeURIComponent(orderId)}/verify`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Account', 'Payment'],
    }),

    getUsageSummary: build.query<UsageSummary, { days: number; timeZone: string }>({
      query: ({ days, timeZone }) =>
        `/usage/summary?days=${days}&tz=${encodeURIComponent(timeZone)}`,
      providesTags: ['Usage'],
    }),

    getUsageEvents: build.query<{ items: UsageEvent[] }, void>({
      query: () => '/usage/events?limit=30',
      providesTags: ['Usage'],
    }),

    /** A file's name and state, for the chips on sent messages. */
    getFile: build.query<{ file: UploadedFile }, string>({
      query: (id) => `/files/${encodeURIComponent(id)}`,
    }),

    createChat: build.mutation<{ chat: ChatSummary }, { title?: string }>({
      query: (body) => ({ url: '/chats', method: 'POST', body }),
      invalidatesTags: [LIST],
    }),

    // Rename or pin. The list shows the change at once and is put back if the call fails.
    updateChat: build.mutation<{ chat: ChatSummary }, UpdateChatArgs>({
      query: ({ id, ...body }) => ({ url: `/chats/${id}`, method: 'PATCH', body }),
      async onQueryStarted({ id, ...changes }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData('listChats', undefined, (draft) => {
            for (const page of draft.pages) {
              const chat = page.items.find((item) => item.id === id);
              if (chat) {
                Object.assign(chat, changes);
              }
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_result, _error, { id }) => [LIST, { type: 'Chat', id }],
    }),

    // Delete. The chat leaves the list at once and comes back if the call fails.
    deleteChat: build.mutation<void, string>({
      query: (id) => ({ url: `/chats/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData('listChats', undefined, (draft) => {
            for (const page of draft.pages) {
              page.items = page.items.filter((item) => item.id !== id);
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [LIST],
    }),
  }),
});

export const {
  useListChatsInfiniteQuery,
  useSearchChatsQuery,
  useGetChatQuery,
  useGetAccountQuery,
  useGetFileQuery,
  useGetPlansQuery,
  useGetPaymentsQuery,
  useCreateOrderMutation,
  useVerifyPaymentMutation,
  useGetUsageSummaryQuery,
  useGetUsageEventsQuery,
  useCreateChatMutation,
  useUpdateChatMutation,
  useDeleteChatMutation,
} = api;

interface Problem {
  detail?: string;
  title?: string;
  requestId?: string;
}

/** A message for a failed call: the service's own detail when it sent problem+json. */
export function errorMessage(error: unknown): { message: string; requestId?: string } {
  const failed = error as FetchBaseQueryError | undefined;
  if (failed && typeof failed.status === 'number' && typeof failed.data === 'object') {
    const problem = (failed.data ?? {}) as Problem;
    return {
      message: problem.detail ?? problem.title ?? 'Something went wrong',
      ...(problem.requestId ? { requestId: problem.requestId } : {}),
    };
  }
  if (failed?.status === 'FETCH_ERROR') {
    return { message: 'Could not reach GilderAi. Check your connection.' };
  }
  return { message: 'Something went wrong' };
}
