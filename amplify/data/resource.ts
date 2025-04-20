import { type ClientSchema, a, defineData } from "@aws-amplify/backend";


const schema = a.schema({
  Todo: a.model({
    content: a.string().required(),
    isDone:  a.boolean().default(false),
  })
  .authorization((allow) => [allow.owner()]),

  Conversation: a.model({
    title: a.string().required(),
    
    // back-references
    participants: a.hasMany("Participant", "conversationID"),
    messages:     a.hasMany("Message",     "conversationID"),
  })
  .authorization((allow) => [allow.publicApiKey()]),

  Participant: a.model({
    conversationID: a.id().required(),
    userID:         a.id().required(),
    // relationship to Conversation
    conversation:   a.belongsTo("Conversation", "conversationID"),
  })
  // list participants by user and by conversation
  .secondaryIndexes((idx) => [
    idx("userID").queryField("participantsByUser"),
    idx("conversationID").queryField("participantsByConversation"),
  ])
  .authorization((allow) => [allow.publicApiKey()]),

  Message: a.model({
    conversationID: a.id().required(),
    senderID:       a.id().required(),
    content:        a.string().required(),
    // timestamp for sorting
    createdAt:      a.datetime(),
    // relationship to Conversation
    conversation:   a.belongsTo("Conversation", "conversationID"),
  })
  // page and sort messages by createdAt
  .secondaryIndexes((idx) => [
    idx("conversationID").sortKeys(["createdAt"]).queryField("messagesByConversation"),
  ])
  .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
