import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useSession } from "../session/provider";
import { LearningMaterialsView } from "../features/materials/LearningMaterialsView";
import type { MaterialPage, MaterialsAccess } from "../services/api/materials";

type Selection = { owner: string; lessonId: string; id: string };
type Read = { owner: string; lessonId: string; api: MaterialsAccess; reload: number; page?: MaterialPage; error?: Error };

export default function MaterialsScreen() {
  const params = useLocalSearchParams<{ lessonId?: string }>();
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";
  const { profile, materials: api } = useSession();
  const owner = profile?.id ?? "";
  const [focused, setFocused] = useState(false), [reload, setReload] = useState(0);
  const [read, setRead] = useState<Read | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null), [materialRemoved, setMaterialRemoved] = useState(false);
  const selectionRef = useRef<Selection | null>(null);
  const select = useCallback((value: Selection | null) => { selectionRef.current = value; setSelection(value); }, []);
  useEffect(() => { select(null); setMaterialRemoved(false); }, [owner, lessonId, select]);

  useFocusEffect(useCallback(() => {
    if (!owner) return;
    let active = true;
    setFocused(true); setRead(null); setMaterialRemoved(false);
    if (lessonId) {
      void api.getLessonMaterials(lessonId).then(page => {
        if (!active) return;
        const selected = selectionRef.current;
        if (selected?.owner === owner && selected.lessonId === lessonId && !page.items.some(item => item.id === selected.id)) {
          select(null); setMaterialRemoved(true);
        }
        setRead({ owner, lessonId, api, reload, page });
      }).catch(cause => {
        if (!active) return;
        select(null);
        setRead({ owner, lessonId, api, reload, error: cause instanceof Error ? cause : new Error("Check your connection and try again.") });
      });
    }
    return () => { active = false; setFocused(false); setRead(null); };
  }, [api, owner, lessonId, reload, select]));

  const current = focused && read?.owner === owner && read.lessonId === lessonId && read.api === api && read.reload === reload ? read : null;
  const selectedId = selection?.owner === owner && selection.lessonId === lessonId ? selection.id : null;
  // Native/system Back leaves the reading view before leaving the materials route.
  usePreventRemove(focused && !!selectedId, () => select(null));
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedId) { select(null); return true; }
      if (!router.canGoBack()) { router.replace(profile?.role === "instructor" ? "/instructor" : "/student"); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [selectedId, select, profile?.role]));
  const back = () => {
    if (selectedId) select(null);
    else if (router.canGoBack()) router.back();
    else router.replace(profile?.role === "instructor" ? "/instructor" : "/student");
  };
  const error = current?.error;
  const unavailable = !!error && [401, 403, 404].includes((error as Error & { status?: number }).status ?? 0);
  if (!profile || !focused) return null;
  return <LearningMaterialsView lessonId={lessonId} page={current?.page ?? null}
    loading={!!lessonId && !current} missingLesson={!lessonId} error={error?.message ?? ""} unavailable={unavailable}
    selectedId={selectedId} materialRemoved={materialRemoved} onBack={back} onList={() => select(null)}
    onAccount={() => router.push("/account")} onRefresh={() => setReload(value => value + 1)}
    onRead={id => { if (current?.page?.items.some(item => item.id === id)) { setMaterialRemoved(false); select({ owner, lessonId, id }); } }} />;
}
