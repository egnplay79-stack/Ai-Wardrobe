import type { Look, Outfit, WardrobeItem } from "../../types";
import type { NewItem, NewLook, NewOutfit, StorageAdapter, WardrobeState } from "./StorageAdapter";
import { uid } from "../../utils/id";

const DB = "ai-wardrobe", VERSION = 2;
type Row<T> = T & { image?: Blob };

/** IndexedDB on the device; falls back to memory when IndexedDB is blocked (private mode, sandbox). */
export class LocalStorageAdapter implements StorageAdapter {
  kind: "local" | "memory" = "local";
  private db: IDBDatabase | null = null;
  private items: WardrobeItem[] = [];
  private outfits: Outfit[] = [];
  private looks: Look[] = [];
  private listeners = new Set<(s: WardrobeState) => void>();
  private readonly userId = "local";

  async init() {
    try {
      this.db = await openDb();
      const rows = await all<Row<WardrobeItem>>(this.db, "items");
      this.items = rows
        .map(({ image, ...it }) => ({ ...it, imageUrl: image ? URL.createObjectURL(image) : it.imageUrl }))
        .sort((a, b) => b.createdAt - a.createdAt);
      this.outfits = (await all<Outfit>(this.db, "outfits")).sort((a, b) => b.createdAt - a.createdAt);
      this.looks = (await all<Row<Look>>(this.db, "looks"))
        .map(({ image, ...l }) => ({ ...l, imageUrl: image ? URL.createObjectURL(image) : l.imageUrl }))
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      this.db = null;
      this.kind = "memory";
    }
    this.emit();
  }

  subscribe(fn: (s: WardrobeState) => void) {
    this.listeners.add(fn);
    fn(this.state());
    return () => { this.listeners.delete(fn); };
  }

  async addItem(data: NewItem, image: Blob) {
    const item: WardrobeItem = { ...data, id: uid("it_"), userId: this.userId, imageUrl: URL.createObjectURL(image), createdAt: Date.now() };
    if (this.db) await put(this.db, "items", { ...item, imageUrl: "", image });
    this.items = [item, ...this.items];
    this.emit();
    return item;
  }

  async updateItem(id: string, patch: Partial<NewItem>) {
    const cur = this.items.find((i) => i.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    if (this.db) {
      const row = await get<Row<WardrobeItem>>(this.db, "items", id);
      await put(this.db, "items", { ...row, ...patch });
    }
    this.items = this.items.map((i) => (i.id === id ? next : i));
    this.emit();
  }

  async deleteItem(item: WardrobeItem) {
    if (this.db) await del(this.db, "items", item.id);
    URL.revokeObjectURL(item.imageUrl);
    this.items = this.items.filter((i) => i.id !== item.id);
    this.emit();
  }

  async addOutfits(list: NewOutfit[]) {
    const now = Date.now();
    const created = list.map((o, i) => ({ ...o, id: uid("of_"), userId: this.userId, createdAt: now - i }));
    if (this.db) for (const o of created) await put(this.db, "outfits", o);
    this.outfits = [...created, ...this.outfits];
    this.emit();
    return created;
  }

  async updateOutfit(id: string, patch: Partial<NewOutfit>) {
    const cur = this.outfits.find((o) => o.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    if (this.db) await put(this.db, "outfits", next);
    this.outfits = this.outfits.map((o) => (o.id === id ? next : o));
    this.emit();
  }

  async deleteOutfits(ids: string[]) {
    if (this.db) for (const id of ids) await del(this.db, "outfits", id);
    this.outfits = this.outfits.filter((o) => !ids.includes(o.id));
    this.emit();
  }

  async addLook(data: NewLook, image: Blob) {
    const look: Look = { ...data, id: uid("lk_"), userId: this.userId, imageUrl: URL.createObjectURL(image), createdAt: Date.now() };
    if (this.db) await put(this.db, "looks", { ...look, imageUrl: "", image });
    this.looks = [look, ...this.looks];
    this.emit();
    return look;
  }

  async updateLook(id: string, patch: Partial<NewLook>) {
    const cur = this.looks.find((l) => l.id === id);
    if (!cur) return;
    if (this.db) {
      const row = await get<Row<Look>>(this.db, "looks", id);
      await put(this.db, "looks", { ...row, ...patch });
    }
    this.looks = this.looks.map((l) => (l.id === id ? { ...cur, ...patch } : l));
    this.emit();
  }

  async deleteLook(look: Look) {
    if (this.db) await del(this.db, "looks", look.id);
    URL.revokeObjectURL(look.imageUrl);
    this.looks = this.looks.filter((l) => l.id !== look.id);
    this.emit();
  }

  private state(): WardrobeState {
    return { items: this.items, outfits: this.outfits, looks: this.looks };
  }
  private emit() {
    const s = this.state();
    this.listeners.forEach((l) => l(s));
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of ["items", "outfits", "looks"]) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}
const all = <T,>(db: IDBDatabase, s: string) => tx<T[]>(db, s, "readonly", (st) => st.getAll());
const get = <T,>(db: IDBDatabase, s: string, id: string) => tx<T>(db, s, "readonly", (st) => st.get(id));
const put = (db: IDBDatabase, s: string, v: unknown) => tx(db, s, "readwrite", (st) => st.put(v));
const del = (db: IDBDatabase, s: string, id: string) => tx(db, s, "readwrite", (st) => st.delete(id));
