import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { Text } from "../../accessibility/Primitives";

import type { AssignmentPage } from "../../services/api/assignments";
import { homeColors } from "../../theme/personal";
import { Action, classroomArt, m } from "./MonitoringUI";

// This page owns only monitoring reads; other assignment pickers retain their presentation.
export function MonitoringPage<P extends AssignmentPage<unknown>>({ fetch, render, renderHeader, renderFooter, emptyTitle, emptyDescription, filtered = false, onClear, loadingLabel = "Loading your overview…" }: {
  fetch: (offset: number) => Promise<P>;
  render: (row: P["items"][number], index: number) => ReactNode;
  renderHeader?: (page: P | null) => ReactNode;
  renderFooter?: (page: P) => ReactNode;
  emptyTitle: string; emptyDescription: string; filtered?: boolean; onClear?: () => void; loadingLabel?: string;
}) {
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0);
  const [page, setPage] = useState<P | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setPage(null); setError("");
      fetch(offset).then(value => { if (active) setPage(value); }).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : "Check your connection and try again.");
      });
    });
    return () => { active = false; };
  }, [fetch, offset, retry]);
  function move(next: number) { setPage(null); setError(""); setOffset(next); }
  return <>
    {renderHeader?.(page)}
    {!!error ? <View style={[m.card, m.state]} accessibilityRole="alert">
      <Text accessibilityRole="header" style={[m.cardTitle, m.stateText]}>We couldn’t load this overview</Text>
      <Text style={[m.note, m.stateText]}>{error}</Text>
      <Action label="Try again" onPress={() => { setError(""); setRetry(value => value + 1); }} />
    </View> : !page ? <View style={[m.card, m.state]} accessibilityLiveRegion="polite" accessibilityState={{ busy: true }}>
      <View style={m.stateArt}><ActivityIndicator color={homeColors.teal} /></View>
      <Text style={[m.cardTitle, m.stateText]}>{loadingLabel}</Text><Text style={[m.note, m.stateText]}>Getting the latest class activity.</Text>
    </View> : <>
      {!page.items.length && <View style={[m.card, m.state]}>
        {!filtered && <View style={m.stateArt}><Image accessible={false} source={classroomArt} resizeMode="contain" style={m.stateImage} /></View>}
        <Text accessibilityRole="header" style={[m.cardTitle, m.stateText]}>{filtered ? "No matches found" : emptyTitle}</Text>
        <Text style={[m.note, m.stateText]}>{filtered ? "Try another search or clear your filters." : emptyDescription}</Text>
        {filtered && onClear && <Action label="Clear search and filters" onPress={onClear} />}
      </View>}
      <View style={m.list}>{page.items.map(render)}</View>
      {(offset > 0 || page.has_more) && <View style={m.pagination}>
        <Action outline label="Previous" disabled={!offset} onPress={() => move(Math.max(0, offset - 20))} />
        <Text accessibilityLiveRegion="polite" style={m.pageLabel}>Page {Math.floor(offset / 20) + 1}</Text>
        <Action outline label="Next" disabled={!page.has_more} onPress={() => move(offset + 20)} />
      </View>}
      {renderFooter?.(page)}
    </>}
  </>;
}
