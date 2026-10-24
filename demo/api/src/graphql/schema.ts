// The Hugjuulai GraphQL API: shared types and fields here, then each module's
// typeDefs and resolvers from modules/<module>/graphql.ts. Every type is
// prefixed `Hugjuulai` and every root field `hugjuulai`: inside erxes the
// gateway composes all plugins into one supergraph, so names must be unique.

import { checkAllStatus } from "../ai/llm.ts";
import { problemhuntResolvers, problemhuntTypeDefs } from "../modules/problemhunt/graphql.ts";
import { taskmindResolvers, taskmindTypeDefs } from "../modules/taskmind/graphql.ts";
import { teacherrateResolvers, teacherrateTypeDefs } from "../modules/teacherrate/graphql.ts";
import { getDb, resetDb } from "../store.ts";

const sharedTypeDefs = /* GraphQL */ `
  type HugjuulaiUser {
    _id: String!
    name: String!
    role: String!
    subject: String
    classId: String
    className: String
    title: String
    specialties: [String!]
    rooms: [String!]
  }

  type HugjuulaiClass {
    _id: String!
    name: String!
  }

  type HugjuulaiAiStatus {
    provider: String!
    model: String!
    online: Boolean!
    message: String
    "The provider used for prioritization (Begin, AI-sorted Inbox): DigitalOcean when DO_API_KEY is set."
    priority: HugjuulaiAiStatus
  }

  type Query {
    hugjuulaiUsers: [HugjuulaiUser!]!
    hugjuulaiClasses: [HugjuulaiClass!]!
    hugjuulaiAiStatus: HugjuulaiAiStatus!
  }

  type Mutation {
    hugjuulaiDemoReset: Boolean!
  }
`;

const sharedResolvers = {
  Query: {
    hugjuulaiUsers: () => {
      const { users, classes } = getDb();
      return users.map((u) => ({ ...u, className: classes.find((c) => c._id === u.classId)?.name ?? null }));
    },

    hugjuulaiClasses: () => getDb().classes,

    hugjuulaiAiStatus: () => checkAllStatus(),
  },

  Mutation: {
    hugjuulaiDemoReset: () => {
      resetDb();
      return true;
    },
  },
};

export const typeDefs = sharedTypeDefs + taskmindTypeDefs + problemhuntTypeDefs + teacherrateTypeDefs;

export const resolvers = {
  Query: {
    ...sharedResolvers.Query,
    ...taskmindResolvers.Query,
    ...problemhuntResolvers.Query,
    ...teacherrateResolvers.Query,
  },
  Mutation: {
    ...sharedResolvers.Mutation,
    ...taskmindResolvers.Mutation,
    ...problemhuntResolvers.Mutation,
    ...teacherrateResolvers.Mutation,
  },
};
