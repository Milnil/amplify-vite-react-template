import { useState, useEffect } from 'react';
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { fetchMessages } from '../funcs.ts';


const client = generateClient<Schema>();
type Message = Schema['Message']['type'];

export function useMessagesForConversation(conversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    // initial load
    fetchMessages(conversationId).then(sorted => setMessages(sorted));

    // subscribe to updates
    const sortByTime = (a: Message, b: Message) =>
      new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();

    const subscription = client.models.Message
      .observeQuery({
        filter: { conversationID: { eq: conversationId } },
      })
      .subscribe({
        next: ({ items }) => setMessages(items.slice().sort(sortByTime)),
        error: console.error,
      });

    return () => subscription.unsubscribe();
  }, [conversationId]);

  return messages;
}
