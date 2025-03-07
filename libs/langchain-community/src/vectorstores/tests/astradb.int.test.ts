/* eslint-disable no-process-env */
import { describe, expect, test } from "@jest/globals";
import { AstraDB } from "@datastax/astra-db-ts";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { AstraDBVectorStore, AstraLibArgs } from "../astradb.js";

describe.skip("AstraDBVectorStore", () => {
  const clientConfig = {
    token: process.env.ASTRA_DB_APPLICATION_TOKEN ?? "dummy",
    endpoint: process.env.ASTRA_DB_ENDPOINT ?? "dummy",
    namespace: process.env.ASTRA_DB_NAMESPACE ?? "default_keyspace",
  };

  const client = new AstraDB(clientConfig.token, clientConfig.endpoint);

  const astraConfig: AstraLibArgs = {
    ...clientConfig,
    collection: process.env.ASTRA_DB_COLLECTION ?? "langchain_test",
    collectionOptions: {
      vector: {
        dimension: 1536,
        metric: "cosine",
      },
    },
  };

  beforeEach(async () => {
    try {
      await client.dropCollection(astraConfig.collection);
    } catch (e) {
      console.debug("Collection doesn't exist yet, skipping drop");
    }
  });

  test("addDocuments", async () => {
    const store = new AstraDBVectorStore(new OpenAIEmbeddings(), astraConfig);
    await store.initialize();

    const pageContent: string[] = [
      faker.lorem.sentence(5),
      faker.lorem.sentence(5),
    ];
    const metadata = [{ foo: "bar" }, { foo: "baz" }];

    await store.addDocuments(
      pageContent.map(
        (content, idx) =>
          new Document({ pageContent: content, metadata: metadata[idx] })
      )
    );

    const results = await store.similaritySearch(pageContent[0], 1);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual(pageContent[0]);
    expect(results[0].metadata.foo).toEqual(metadata[0].foo);
  });

  test("fromText", async () => {
    const store = await AstraDBVectorStore.fromTexts(
      [
        "AstraDB is built on Apache Cassandra",
        "AstraDB is a NoSQL DB",
        "AstraDB supports vector search",
      ],
      [{ id: 123 }, { id: 456 }, { id: 789 }],
      new OpenAIEmbeddings(),
      astraConfig
    );

    const results = await store.similaritySearch("Apache Cassandra", 1);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual(
      "AstraDB is built on Apache Cassandra"
    );
    expect(results[0].metadata.id).toEqual(123);
  });

  test("fromExistingIndex", async () => {
    await AstraDBVectorStore.fromTexts(
      [
        "AstraDB is built on Apache Cassandra",
        "AstraDB is a NoSQL DB",
        "AstraDB supports vector search",
      ],
      [{ id: 123 }, { id: 456 }, { id: 789 }],
      new OpenAIEmbeddings(),
      astraConfig
    );

    const store2 = await AstraDBVectorStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      astraConfig
    );

    const results = await store2.similaritySearch("Apache Cassandra", 1);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual(
      "AstraDB is built on Apache Cassandra"
    );
    expect(results[0].metadata.id).toEqual(123);
  });

  test("delete", async () => {
    const store = await AstraDBVectorStore.fromTexts(
      [
        "AstraDB is built on Apache Cassandra",
        "AstraDB is a NoSQL DB",
        "AstraDB supports vector search",
      ],
      [{ id: 123 }, { id: 456 }, { id: 789 }],
      new OpenAIEmbeddings(),
      astraConfig
    );

    const results = await store.similaritySearch("Apache Cassandra", 1);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual(
      "AstraDB is built on Apache Cassandra"
    );
    expect(results[0].metadata.id).toEqual(123);

    await store.delete({ ids: [results[0].metadata._id] });

    const results2 = await store.similaritySearch("Apache Cassandra", 1);

    expect(results2[0].pageContent).not.toBe(
      "AstraDB is built on Apache Cassandra"
    );
  });
});
