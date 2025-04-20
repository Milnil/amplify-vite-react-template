// funcs.ts (data layer)
import { Schema } from "../amplify/data/resource"
import { generateClient } from "aws-amplify/data"
import { getCurrentUser } from "aws-amplify/auth"

const client = generateClient<Schema>()

type Conversation = Schema["Conversation"]["type"]
type Participant = Schema["Participant"]["type"]


/**
 * Creates a new conversation with the given name and adds the two users as participants.
 * @param name - the name/title of the conversation
 * @param userId - the current user ID
 * @param otherUserId - the other user's ID to invite
 * @returns the created Conversation object
 */
export async function createConversation(
  name: string,
  userId: string,
  otherUserId: string
): Promise<Conversation> {
  // 1) create the conversation
  const result = await client.models.Conversation.create({
    title: name 
  })
  if (!result.data) {
    throw new Error('Failed to create conversation')
  }
  const convo = result.data

  // 2) add participants
  const p1 = await client.models.Participant.create({
    conversationID: convo.id, userID: userId 
  })
  const p2 = await client.models.Participant.create({
    conversationID: convo.id, userID: otherUserId 
  })
  if (!p1.data || !p2.data) {
    throw new Error('Failed to add participants')
  }

  return convo
}


/**
 * Fetches and returns messages for a given conversation, sorted by creation time.
 * @param conversationID - the ID of the conversation
 */
export async function fetchMessages(
  conversationID: string
): Promise<Schema['Message']['type'][]> {
  const res = await client.models.Conversation.get(
    { id: conversationID },
    { selectionSet: ['messages.*'] }
  )
  const msgs = res.data?.messages ?? []
  // sort ascending by createdAt timestamp
  return msgs.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}


/**
 * Fetches and returns all conversations the given user participates in,
 * sorted by most recently updated first.
 */
export async function fetchConversations(
  userId: string
): Promise<Conversation[]> {
  // 1) List participant rows to get conversation IDs
  const partRes = await client.models.Participant.list({ filter: { userID: { eq: userId } } })
  const parts = partRes.data ?? []

  // 2) Fetch each conversation by ID
  const wrappers = await Promise.all(
    parts.map(p => client.models.Conversation.get({ id: p.conversationID }))
  )

  // 3) Unwrap and filter valid conversations
  const convos = wrappers
    .map(r => r.data)
    .filter((c): c is Conversation => Boolean(c))
  
  // 4) Sort by updatedAt descending (most recent first)
  return convos.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * Deletes a conversation and all its messages and participants.
 */
export async function deleteConversation(
  conversationID: string
): Promise<void> {
  const res = await client.models.Conversation.get(
    { id: conversationID },
    { selectionSet: ['messages.*', 'participants.*'] }
  );
  const convo = res.data;
  if (!convo) throw new Error('Conversation not found');

  await Promise.all(
    convo.messages.map(m => client.models.Message.delete({ id: m.id }))
  );
  await Promise.all(
    convo.participants.map(p => client.models.Participant.delete({ id: p.id }))
  );
  await client.models.Conversation.delete({ id: conversationID });
}
