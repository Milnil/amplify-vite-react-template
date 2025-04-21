import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { createConversation, fetchMessages, fetchConversations, deleteConversation } from './funcs.ts';

const client = generateClient<Schema>();

export default function App() {
  const { user, signOut } = useAuthenticator();
  // Log Cognito identifiers for debugging

  const myID = user?.username ?? user?.signInDetails?.loginId;
  if (!myID) {
    return <div style={{ padding: 20 }}>Loading user...</div>;
  }

  const [convos, setConvos] = useState<Schema["Conversation"]["type"][]>([]);
  const [current, setCurrent] = useState<Schema["Conversation"]["type"] | null>(null);
  const [messages, setMessages] = useState<Schema["Message"]["type"][]>([]);
  const [newMsg, setNewMsg] = useState<string>("");
  type Message = Schema['Message']['type'];


  // Fetch initial conversations and subscribe to changes
  useEffect(() => {

    if (!myID) return;
    fetchConversations(myID)
      .then(setConvos)
      .catch(err => console.error('Failed to load conversations:', err));

    console.log(convos)

    const sub = client.models.Participant.observeQuery({ filter: { userID: { eq: myID } } })
      .subscribe({
        next: async () => {
          try {
            const updated = await fetchConversations(myID)
            setConvos(updated)
          } catch (err) {
            console.error('Failed to refresh conversations:', err)
          }
        },
        error: console.error
      })

    return () => sub.unsubscribe();
  }, [myID]);

  // Load and subscribe to messages for the selected conversation
  useEffect(() => {
    if (!current) return;

    fetchMessages(current.id).then(sorted => setMessages(sorted));

    const sortByTime = (a: Message, b: Message) =>
      new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();

    const sub = client.models.Message.observeQuery({
      filter: { conversationID: { eq: current.id } }
    }).subscribe({
      next: ({ items }) => {
        const sorted = items.slice().sort(sortByTime);
        setMessages(sorted);
      },
      error: console.error
    });

    return () => sub.unsubscribe();
  }, [current]);

  async function createConvo() {
    const convotitle = window.prompt("Conversation title?");
    const other = window.prompt("Invite user (username)?");
    if (!convotitle || !other) return;

    try {

      const newConvo = await createConversation(convotitle, myID, other)

      setConvos(prev => [newConvo, ...prev]);
      setCurrent(newConvo);
    } catch (err) {
      console.error("Error creating conversation or participants:", err);
      alert("Error creating conversation");
    }
  }

  async function sendMessage() {
    if (!current || !newMsg.trim()) return;

    try {
      const result = await client.models.Message.create({
        conversationID: current.id,
        senderID: myID,
        content: newMsg.trim()
      });
      if (!result.data) throw new Error("No message returned from AWS");
      const createdMessage = result.data;

      // UI update
      setMessages(prev => [...prev, createdMessage]);
      setNewMsg("");
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message");
    }
  }

  async function handleDelete() {
    if (!current) return;
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await deleteConversation(current.id)
      setConvos(prev => prev.filter(c => c.id !== current.id))
      setCurrent(null)
      setMessages([])
    } catch (err) {
      console.error(err)
      alert('Failed to delete conversation')
    }
  }

  return (
    <main style={{ display: "flex", height: "100vh" }}>
      <aside
        style={{
          width: 260,
          borderRight: "1px solid #ccc",
          padding: 16,
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <strong>User:</strong> {myID}
        </div>
        <button onClick={createConvo} style={{ marginBottom: 16 }}>
          + New Conversation
        </button>
        {convos.length === 0 ? (
          <p>No conversations yet.</p>
        ) : (
          <ul
            style={{ listStyle: "none", padding: 0, flex: 1, overflowY: "auto" }}
          >
            {convos.map(c => (
              <li
                key={c.id}
                onClick={() => setCurrent(c)}
                style={{
                  cursor: "pointer",
                  padding: "8px 0",
                  fontWeight: current?.id === c.id ? "bold" : "normal"
                }}
              >
                {c.title}
              </li>
            ))}
          </ul>
        )}
        <button onClick={signOut} style={{ marginTop: 16 }}>
          Sign Out
        </button>
      </aside>

      <section
        style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16 }}
      >
        {current ? (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16
              }}
            >
              <h2 style={{ margin: 0 }}>{current.title}</h2>
              <button onClick={handleDelete} style={{ color: "red" }}>
                Delete
              </button>
            </div>
            <div
              style={{ flex: 1, overflowY: "auto", border: "1px solid #ddd", padding: 12 }}
            >
              {messages.length === 0 ? (
                <p>No messages yet.</p>
              ) : (
                messages.map(m => (
                  <div key={m.id} style={{ marginBottom: 12 }}>
                    <div>
                      <strong>{m.senderID}</strong>
                      <span style={{ color: '#666', fontSize: '0.8em', marginLeft: 8 }}>
                        {new Date(m.createdAt || '').toLocaleString()}
                      </span>
                    </div>
                    <div>{m.content}</div>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                sendMessage();
              }}
              style={{ display: "flex", marginTop: 12 }}>
              <input
                type="text"
                placeholder="Type a message..."
                style={{ flex: 1, padding: 10 }}
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
              />
              <button type="submit" style={{ marginLeft: 8 }}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: "center", marginTop: 64 }}>
            Select or create a conversation
          </div>
        )}
      </section>
    </main>
  );
}
