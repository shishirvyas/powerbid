/**
 * Multi-contact-person sub-API for a customer:
 *   GET    /:customerId/contacts
 *   POST   /:customerId/contacts
 *   PUT    /:customerId/contacts/:contactId
 *   DELETE /:customerId/contacts/:contactId
 *
 * "isPrimary" is enforced uniquely per customer at write time.
 */
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { customerContactInput } from "@powerbid/shared";
import type { AppEnv } from "../../index";
import { getDb } from "../../db/client";
import { customerContacts } from "../../db/schema";
import { parseId, parseJson } from "../../lib/validate";
import { notFound } from "../../lib/errors";
import { logActivity } from "../../lib/activity";

export const customerContactsRoutes = new Hono<AppEnv>();

customerContactsRoutes.get("/:id/contacts", async (c) => {
  const id = parseId(c.req.param("id"));
  const db = getDb(c.env.DB);
  const items = await db
    .select()
    .from(customerContacts)
    .where(
      and(eq(customerContacts.customerId, id), eq(customerContacts.isActive, true)),
    );
  return c.json({ items });
});

customerContactsRoutes.post("/:id/contacts", async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseJson(c.req.raw, customerContactInput);
  const db = getDb(c.env.DB);
  const userId = c.get("userId") ?? null;
  if (input.isPrimary) await clearPrimary(db, id);
  const [row] = await db
    .insert(customerContacts)
    .values({
      customerId: id,
      name: input.name,
      designation: input.designation ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      isPrimary: input.isPrimary,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();
  await logActivity(db, {
    entity: "customer",
    entityId: id,
    action: "contact.added",
    userId,
    payload: { contactId: row.id, name: row.name },
  });
  return c.json(row, 201);
});

customerContactsRoutes.put("/:id/contacts/:contactId", async (c) => {
  const customerId = parseId(c.req.param("id"));
  const contactId = parseId(c.req.param("contactId"), "contactId");
  const input = await parseJson(c.req.raw, customerContactInput);
  const db = getDb(c.env.DB);
  const userId = c.get("userId") ?? null;
  const [existing] = await db
    .select()
    .from(customerContacts)
    .where(
      and(eq(customerContacts.id, contactId), eq(customerContacts.customerId, customerId)),
    )
    .limit(1);
  if (!existing) throw notFound("Contact not found");
  if (input.isPrimary) await clearPrimary(db, customerId, contactId);
  await db
    .update(customerContacts)
    .set({
      name: input.name,
      designation: input.designation ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      isPrimary: input.isPrimary,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(customerContacts.id, contactId));
  return c.json({ id: contactId });
});

customerContactsRoutes.delete("/:id/contacts/:contactId", async (c) => {
  const customerId = parseId(c.req.param("id"));
  const contactId = parseId(c.req.param("contactId"), "contactId");
  const db = getDb(c.env.DB);
  await db
    .update(customerContacts)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(
      and(eq(customerContacts.id, contactId), eq(customerContacts.customerId, customerId)),
    );
  return c.json({ id: contactId, deleted: true });
});

async function clearPrimary(
  db: ReturnType<typeof getDb>,
  customerId: number,
  except?: number,
) {
  const where = except
    ? and(
        eq(customerContacts.customerId, customerId),
        eq(customerContacts.isPrimary, true),
      )
    : and(
        eq(customerContacts.customerId, customerId),
        eq(customerContacts.isPrimary, true),
      );
  await db.update(customerContacts).set({ isPrimary: false }).where(where);
}
