import type { Look, Outfit, WardrobeItem } from "../../types";
import type { NewItem, NewLook, NewOutfit, StorageAdapter, WardrobeState } from "./StorageAdapter";
import { useRuntime } from "../ai/claudeRuntime";

/* Minimal shapes of the Claude artifact runtime's db / assets / user capabilities. */
interface Snap { id: string; data(): Record<string, unknown> | undefined }
interface DocRef { set(d: Record<string, unknown>): Promise<void>; update(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> }
interface Coll { doc(id?: string): DocRef & { id: string }; onSnapshot(next: (s: { docs: Snap[] }) => void, err?: (e: unknown) => void): () => void }
interface Db { collection(path: string): Coll }
interface Assets { upload(b: Blob, o?: { type?: string }): Promise<{ id: string; url: string }>; delete(id: string): Promise<unknown> }
interface User { id(): Promise<string | null> }

/** Private per-user storage when the app runs inside Claude: rows in `db`, photos in `assets`. */
export class ArtifactStorageAdapter implements StorageAdapter {
  readonly kind = "artifact" as const;
  private state: WardrobeState = { items: [], outfits: [], looks: [] };
  private listeners = new Set<(s: WardrobeState) => void>();
  private constructor(private db: Db, private assets: Assets, private userId: string) {}

  /** Resolves null when the runtime can't provide private storage (signed out, read-only view). */
  static async create(): Promise<ArtifactStorageAdapter | null> {
    const [db, assets, user] = await Promise.all([useRuntime<Db>("db"), useRuntime<Assets>("assets"), useRuntime<User>("user")]);
    if (!db || !assets || !user) return null;
    const id = await user.id().catch(() => null);
    return id ? new ArtifactStorageAdapter(db, assets, id) : null;
  }

  private get coll() {
    return this.db.collection("data/users/" + this.userId);
  }

  init(): Promise<void> {
    return new Promise((resolve) => {
      let first = true;
      this.coll.onSnapshot(
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }) as Record<string, unknown> & { id: string; kind?: string });
          this.state = {
            items: rows.filter((r) => r.kind === "item").map((r) => ({ ...r, imageUrl: "/_blob/" + r.imageRef }) as unknown as WardrobeItem).sort((a, b) => b.createdAt - a.createdAt),
            outfits: rows.filter((r) => r.kind === "outfit").map((r) => r as unknown as Outfit).sort((a, b) => b.createdAt - a.createdAt),
            looks: rows.filter((r) => r.kind === "look").map((r) => ({ ...r, imageUrl: "/_blob/" + r.imageRef }) as unknown as Look).sort((a, b) => b.createdAt - a.createdAt),
          };
          this.emit();
          if (first) { first = false; resolve(); }
        },
        () => { if (first) { first = false; resolve(); } },
      );
    });
  }

  subscribe(fn: (s: WardrobeState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => { this.listeners.delete(fn); };
  }

  async addItem(data: NewItem, image: Blob) {
    const up = await this.assets.upload(image, { type: image.type || "image/jpeg" });
    const ref = this.coll.doc();
    const item: WardrobeItem = { ...data, id: ref.id, userId: this.userId, imageRef: up.id, imageUrl: up.url, createdAt: Date.now() };
    const { imageUrl: _drop, id: _id, ...row } = item;
    await ref.set(stripUndefined({ ...row, kind: "item" }));
    return item;
  }

  async updateItem(id: string, patch: Partial<NewItem>) {
    await this.coll.doc(id).update(stripUndefined({ ...patch }));
  }

  async deleteItem(item: WardrobeItem) {
    await this.coll.doc(item.id).delete();
    if (item.imageRef) await this.assets.delete(item.imageRef).catch(() => undefined);
  }

  async addOutfits(list: NewOutfit[]) {
    const now = Date.now();
    const created: Outfit[] = [];
    for (const [i, o] of list.entries()) {
      const ref = this.coll.doc();
      const outfit: Outfit = { ...o, id: ref.id, userId: this.userId, createdAt: now - i };
      const { id: _id, ...row } = outfit;
      await ref.set(stripUndefined({ ...row, kind: "outfit" }));
      created.push(outfit);
    }
    return created;
  }

  async updateOutfit(id: string, patch: Partial<NewOutfit>) {
    await this.coll.doc(id).update(stripUndefined({ ...patch }));
  }

  async deleteOutfits(ids: string[]) {
    for (const id of ids) await this.coll.doc(id).delete();
  }

  async addLook(data: NewLook, image: Blob) {
    const up = await this.assets.upload(image, { type: image.type || "image/jpeg" });
    const ref = this.coll.doc();
    const look: Look = { ...data, id: ref.id, userId: this.userId, imageRef: up.id, imageUrl: up.url, createdAt: Date.now() };
    const { imageUrl: _drop, id: _id, ...row } = look;
    await ref.set(stripUndefined({ ...row, kind: "look" }));
    return look;
  }

  async updateLook(id: string, patch: Partial<NewLook>) {
    await this.coll.doc(id).update(stripUndefined({ ...patch }));
  }

  async deleteLook(look: Look) {
    await this.coll.doc(look.id).delete();
    if (look.imageRef) await this.assets.delete(look.imageRef).catch(() => undefined);
  }

  private emit() {
    this.listeners.forEach((l) => l(this.state));
  }
}

function stripUndefined(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
