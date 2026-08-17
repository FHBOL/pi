# @earendil-works/pi-session-backend-sqlite-node

面向 `@earendil-works/pi-agent-core` 会话的 Node sqlite 会话后端。提供
`node:sqlite` 适配器（`SqliteDatabase` 实现）、SQLite 会话仓库、
迁移、物化视图，以及可选的 FTS 搜索。

```ts
await using repository = new SqliteSessionRepository(options);
const search = createSqliteSessionSearch(options);
const session = await repository.create({ cwd });
const hits = await search.search({ text: "needle" });
```

仓库惰性持有一个共享的数据库连接。搜索是独立的、只读的投影，作用在同一份规范数据库上。
