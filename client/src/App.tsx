import { useCallback, useEffect, useRef, useState } from "react";
import { BottomNavigation } from "./components/BottomNavigation";
import { Toast } from "./components/Toast";
import { useAIStatus } from "./hooks/useAIStatus";
import { useItemProcessing } from "./hooks/useItemProcessing";
import { useNavigator } from "./hooks/useNavigator";
import { useOutfitGeneration } from "./hooks/useOutfitGeneration";
import { useWardrobe } from "./hooks/useWardrobe";
import { WardrobeService } from "./services/WardrobeService";
import { SizingService } from "./services/SizingService";
import { setOutfitSaved, type GenerateStrategy } from "./services/OutfitGenerationService";
import { isSaved, type Outfit } from "./types";
import { LoadingState } from "./components/LoadingState";
import { AddItemScreen } from "./screens/AddItemScreen";
import { EditItemScreen } from "./screens/EditItemScreen";
import { ItemDetailScreen } from "./screens/ItemDetailScreen";
import { ItemOutfitsScreen } from "./screens/ItemOutfitsScreen";
import { ItemResultScreen } from "./screens/ItemResultScreen";
import { OutfitDetailScreen } from "./screens/OutfitDetailScreen";
import { OutfitsScreen } from "./screens/OutfitsScreen";
import { ProcessingScreen } from "./screens/ProcessingScreen";
import { WardrobeScreen } from "./screens/WardrobeScreen";
import { OutfitBuilderScreen } from "./screens/OutfitBuilderScreen";
import { LooksScreen } from "./screens/LooksScreen";
import { AboutScreen } from "./screens/AboutScreen";
import { LookEditScreen } from "./screens/LookEditScreen";
import { LookDetailScreen } from "./screens/LookDetailScreen";
import { LookService, type LookDraft } from "./services/LookService";
import type { Filter } from "./components/CategoryFilter";
import type { WardrobeItem } from "./types";

export default function App() {
  const nav = useNavigator();
  const { items, outfits, looks, resolved, byId, ready, storageKind } = useWardrobe();
  const proc = useItemProcessing();
  const gen = useOutfitGeneration();
  const ai = useAIStatus();
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [measuring, setMeasuring] = useState(false);
  /** Picks for "Create outfit", kept apart from the edit-outfit selection. */
  const lastPicks = useRef<Set<string>>(new Set());

  // Outfits show items at true scale. Items without an AI size estimate get measured once,
  // together, the first time they appear in an outfit on screen.
  const showingOutfits = (!nav.route && nav.tab === "outfits") || nav.route?.name === "outfit" || nav.route?.name === "itemOutfits";
  useEffect(() => {
    if (!showingOutfits || measuring) return;
    const inOutfits = [...new Map(resolved.flatMap((r) => r.items).map((i) => [i.id, i])).values()];
    if (!SizingService.needs(inOutfits).length) return;
    setMeasuring(true);
    SizingService.ensure(inOutfits).finally(() => setMeasuring(false));
  }, [showingOutfits, resolved, measuring]);

  // A filter for a category that no longer has items falls back to All.
  useEffect(() => {
    if (filter !== "all" && !items.some((i) => i.category === filter)) setFilter("all");
  }, [items, filter]);

  const openBuilder = () => {
    // Keep the previous picks that still exist; first time, start with everything selected.
    const kept = [...lastPicks.current].filter((id) => byId.has(id));
    setSelected(new Set(kept.length ? kept : items.map((i) => i.id)));
    nav.push({ name: "builder" });
  };

  const generateFrom = async (chosen: WardrobeItem[], strategy: GenerateStrategy = "all") => {
    lastPicks.current = new Set(chosen.map((i) => i.id));
    const res = await gen.generate(chosen, outfits, strategy);
    if (!res.length) return;
    // The best match opens straight away; all combinations land in the Outfits tab.
    if (strategy === "best") nav.replace({ name: "outfit", id: res[0].id });
    else nav.reset("outfits");
  };

  const composeFrom = async (chosen: WardrobeItem[], name?: string) => {
    const editId = nav.route?.name === "builder" ? nav.route.editId : undefined;
    if (editId) {
      if (await gen.edit(editId, chosen, name)) { nav.back(); setToast("Outfit updated"); }
      return;
    }
    lastPicks.current = new Set(chosen.map((i) => i.id));
    const res = await gen.compose(chosen);
    if (res[0]) { nav.replace({ name: "outfit", id: res[0].id }); setToast("Outfit saved"); }
  };

  const editOutfit = (o: Outfit) => {
    setSelected(new Set(o.itemIds));
    nav.push({ name: "builder", editId: o.id });
  };

  const [lookDraft, setLookDraft] = useState<LookDraft | null>(null);
  const startLook = async (file: File) => {
    const d = await LookService.prepare(file).catch(() => null);
    if (!d) { setToast("This photo couldn't be opened. Try another one."); return; }
    setLookDraft(d);
    nav.push({ name: "lookNew" });
  };

  const toggleSave = async (o: Outfit) => {
    const next = !isSaved(o);
    await setOutfitSaved(o.id, next);
    setToast(next ? "Outfit saved" : "Removed from saved");
  };

  useEffect(() => {
    if (ai.fallbackReason) setToast(ai.fallbackReason);
  }, [ai.fallbackReason]);
  useEffect(() => {
    if (gen.error) setToast(gen.error);
  }, [gen.error]);
  const closeToast = useCallback(() => setToast(null), []);

  const startProcessing = async (file: File, force = false) => {
    nav.replace({ name: "processing" });
    const s = await proc.start(file, force);
    if (s && s !== "warn") nav.replace({ name: "result" });
  };

  const saveItem = async () => {
    const item = await proc.save();
    if (item) {
      nav.reset("wardrobe");
      setToast("Added to your wardrobe");
    }
  };

  const discard = () => {
    proc.discard();
    nav.reset();
  };

  const createOutfitFor = (id: string) => {
    const anchor = byId.get(id);
    if (!anchor) return;
    nav.push({ name: "itemOutfits", id });
    gen.generateFor(anchor, items, outfits);
  };

  const removeItem = async (id: string) => {
    const item = byId.get(id);
    if (!item) return;
    const dependent = outfits.filter((o) => o.itemIds.includes(id)).map((o) => o.id);
    nav.back();
    await WardrobeService.removeItem(item, dependent);
  };

  const route = nav.route;
  let screen: JSX.Element;

  if (route?.name === "add") {
    screen = <AddItemScreen onBack={nav.back} onFile={startProcessing} />;
  } else if (route?.name === "processing" || (route?.name === "result" && !proc.session)) {
    screen = (
      <ProcessingScreen
        stage={proc.stage}
        thumb={proc.thumb}
        error={proc.error}
        warning={!!proc.warning}
        onContinue={() => proc.warning && startProcessing(proc.warning, true)}
        onRetake={() => { proc.discard(); nav.replace({ name: "add" }); }}
        onCancel={discard}
      />
    );
  } else if (route?.name === "result" && proc.session) {
    screen = (
      <ItemResultScreen session={proc.session} busy={proc.busy} note={proc.retryNote} onChange={proc.update} onSave={saveItem} onRetry={proc.retry} onSelect={proc.select} onDiscard={discard} />
    );
  } else if (route?.name === "item" && byId.get(route.id)) {
    const item = byId.get(route.id)!;
    screen = (
      <ItemDetailScreen
        item={item}
        creating={gen.generating === item.id}
        onBack={nav.back}
        onEdit={() => nav.push({ name: "edit", id: item.id })}
        onDelete={() => removeItem(item.id)}
        onCreateOutfit={() => createOutfitFor(item.id)}
      />
    );
  } else if (route?.name === "edit" && byId.get(route.id)) {
    const item = byId.get(route.id)!;
    screen = (
      <EditItemScreen
        item={item}
        onBack={nav.back}
        onSave={async (a) => {
          await WardrobeService.updateItem(item.id, a);
          nav.back();
        }}
      />
    );
  } else if (route?.name === "itemOutfits" && byId.get(route.id)) {
    const item = byId.get(route.id)!;
    screen = (
      <ItemOutfitsScreen
        item={item}
        resolved={resolved}
        generating={gen.generating === item.id}
        error={gen.error}
        onBack={nav.back}
        onOpen={(oid) => nav.push({ name: "outfit", id: oid })}
        onToggleSave={toggleSave}
        onRetry={() => gen.generateFor(item, items, outfits)}
        onAdd={() => nav.push({ name: "add" })}
      />
    );
  } else if (route?.name === "builder") {
    screen = (
      <OutfitBuilderScreen
        items={items}
        selected={selected}
        onSelected={(sel) => { setSelected(sel); if (!route.editId) lastPicks.current = sel; }}
        generating={gen.generating === "wardrobe" || gen.generating === "manual"}
        onBack={() => { gen.cancel(); nav.back(); }}
        onGenerate={generateFrom}
        onCompose={composeFrom}
        editing={route.editId ? { name: outfits.find((o) => o.id === route.editId)?.name ?? "" } : undefined}
      />
    );
  } else if (route?.name === "lookNew" && lookDraft) {
    screen = (
      <LookEditScreen
        items={items}
        draft={lookDraft}
        onCancel={() => { URL.revokeObjectURL(lookDraft.previewUrl); setLookDraft(null); nav.back(); }}
        onSave={async (data) => {
          try {
            const look = await LookService.save(data, lookDraft.image);
            setLookDraft(null);
            nav.replace({ name: "look", id: look.id });
            setToast("Look saved");
          } catch {
            setToast("Couldn't save the look. Try again.");
          }
        }}
      />
    );
  } else if (route?.name === "lookEdit" && looks.find((l) => l.id === route.id)) {
    const look = looks.find((l) => l.id === route.id)!;
    screen = (
      <LookEditScreen
        items={items}
        look={look}
        onCancel={nav.back}
        onSave={async (data) => { await LookService.update(look.id, data); nav.back(); }}
      />
    );
  } else if (route?.name === "look" && looks.find((l) => l.id === route.id)) {
    const look = looks.find((l) => l.id === route.id)!;
    const mine = look.itemIds.map((id) => byId.get(id)).filter((x): x is WardrobeItem => !!x);
    screen = (
      <LookDetailScreen
        look={look}
        items={items}
        creating={gen.generating === "manual"}
        onBack={nav.back}
        onOpenItem={(id) => nav.push({ name: "item", id })}
        onMakeOutfit={async () => {
          const res = await gen.compose(mine);
          if (res[0]) { nav.push({ name: "outfit", id: res[0].id }); setToast("Outfit saved"); }
        }}
        onEdit={() => nav.push({ name: "lookEdit", id: look.id })}
        onDelete={async () => { nav.back(); await LookService.remove(look); }}
      />
    );
  } else if (route?.name === "outfit") {
    const r = resolved.find((x) => x.outfit.id === route.id);
    screen = r ? (
      <OutfitDetailScreen
        outfit={r.outfit}
        items={r.items}
        onBack={nav.back}
        onOpenItem={(id) => nav.push({ name: "item", id })}
        onToggleSave={() => toggleSave(r.outfit)}
        onEdit={() => editOutfit(r.outfit)}
        onDelete={async () => {
          nav.back();
          const a = await WardrobeService.init();
          await a.deleteOutfits([r.outfit.id]);
        }}
      />
    ) : (
      <Missing onBack={nav.back} />
    );
  } else if (route) {
    screen = <Missing onBack={nav.back} />;
  } else if (nav.tab === "about") {
    screen = <AboutScreen aiProvider={ai.provider} storage={storageKind} />;
  } else if (nav.tab === "looks") {
    screen = <LooksScreen looks={looks} onFile={startLook} onOpen={(id) => nav.push({ name: "look", id })} />;
  } else if (nav.tab === "outfits") {
    screen = (
      <OutfitsScreen
        itemCount={items.length}
        resolved={resolved}
        onCreate={openBuilder}
        onToggleSave={toggleSave}
        onOpen={(id) => nav.push({ name: "outfit", id })}
        onAdd={() => nav.push({ name: "add" })}
      />
    );
  } else {
    screen = (
      <WardrobeScreen
        items={items}
        ready={ready}
        filter={filter}
        onFilter={setFilter}
        onAdd={() => nav.push({ name: "add" })}
        onOpen={(id) => nav.push({ name: "item", id })}
      />
    );
  }

  return (
    <div className="app">
      {measuring && showingOutfits && (
        <div className="measuring"><LoadingState label="AI is measuring real sizes of your items…" /></div>
      )}
      <div key={route ? route.name + ("id" in route ? route.id : "") : nav.tab} style={{ display: "contents" }}>
        {screen}
      </div>
      {!route && <BottomNavigation tab={nav.tab} onChange={nav.setTab} />}
      {toast && <Toast message={toast} onClose={closeToast} />}
    </div>
  );
}

function Missing({ onBack }: { onBack: () => void }) {
  return (
    <main className="screen no-nav">
      <div className="empty">
        <p>This was removed.</p>
        <div><button className="btn" onClick={onBack}>Back</button></div>
      </div>
    </main>
  );
}
