/**
 * Generic notes timeline + activity feed, mounted under any entity-rooted
 * router (customers, inquiries, quotations) so callers get:
 *   GET  /:id/notes
 *   POST /:id/notes
 *   GET  /:id/activity
 *
 * The `entity` is fixed by the caller when constructing the sub-app, which
 * keeps the URL surface clean and avoids cross-entity ID collisions.
 */
import { Hono } from "hono";
import { desc, eq, and } from "drizzle-orm";
import { noteInput, type NoteEntity } from "@powerbid/shared";
import type { AppEnv } from "../../index";
import { getDb } from "../../db/client";
import { notes, auditLog, users } from "../../db/schema";
import { parseId, parseJson } from "../../lib/validate";

export function createTimelineRoutes(entity: NoteEntity) {
  const r = new Hono<AppEnv>();

  r.get("/:id/notes", async (c) => {
    const id = parseId(c.req.param("id"));
    const db = getDb(c.env.DB);
    const rows = await db
      .select({
        id: notes.id,
        body: notes.body,
        createdAt: notes.createdAt,
        createdBy: notes.createdBy,
        authorName: users.name,
      })
      .from(notes)
      .leftJoin(users, eq(users.id, notes.createdBy))
      .where(and(eq(notes.entity, entity), eq(notes.entityId, id)))
      .orderBy(desc(notes.createdAt))
      .limit(200);
    return c.json({ items: rows });
  });

  r.post("/:id/notes", async (c) => {
    const id = parseId(c.req.param("id"));
    const input = await parseJson(c.req.raw, noteInput);
    const db = getDb(c.env.DB);
    const userId = c.get("userId") ?? null;
    const [row] = await db
      .insert(notes)
      .values({ entity, entityId: id, body: input.body, createdBy: userId })
      .returning();
    return c.json(row, 201);
  });

  r.get("/:id/activity", async (c) => {
    const id = parseId(c.req.param("id"));
    const db = getDb(c.env.DB);
    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        payload: auditLog.payload,
        createdAt: auditLog.createdAt,
        userId: auditLog.userId,
        userName: users.name,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, id)))
      .orderBy(desc(auditLog.createdAt))
      .limit(200);
    // Decode payload JSON for the client
    const items = rows.map((r) => ({
      ...r,
      payload: r.payload ? safeJson(r.payload) : null,
    }));
    return c.json({ items });
  });

  // Combined timeline (notes + activity) ordered by date, useful for the UI.
  r.get("/:id/timeline", async (c) => {
    const id = parseId(c.req.param("id"));
    const result = await c.env.DB.prepare(
      `SELECT 'note' AS kind, n.id AS id, '' AS title, n.body AS body,
              n.created_at AS created_at, u.name AS author
         FROM notes n LEFT JOIN users u ON u.id = n.created_by
        WHERE n.entity = ?1 AND n.entity_id = ?2
       UNION ALL
       SELECT 'activity' AS kind, a.id AS id, a.action AS title, a.payload AS body,
              a.created_at AS created_at, u.name AS author
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
        WHERE a.entity = ?1 AND a.entity_id = ?2
        ORDER BY created_at DESC
        LIMIT 300`,
    )
      .bind(entity, id)
      .all();
    return c.json({ items: result.results ?? [] });
  });

  return r;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
