import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, LayoutChangeEvent } from 'react-native';
import { useNavigation } from 'expo-router';
import { MonotonicClock } from './clock';
import { createPresentationTimer, TimingInterruption } from './timing';

interface ReviewNavigation {
  isFocused(): boolean;
  addListener(event: 'focus' | 'blur' | 'transitionStart' | 'transitionEnd' | 'beforeRemove',
    listener: () => void): () => void;
}

/** onLayout + next frame, guarded by current focus/active/transition signals.
 * The review Stack route disables entry animation; layout alone is not visibility.
 */
export function useReviewTiming(presentationKey: string | null, clock: MonotonicClock) {
  const navigation = useNavigation<ReviewNavigation>();
  const lifecycle = useRef({ appState: AppState.currentState, focused: navigation.isFocused(),
    appBlurred: false, transitioning: false });
  const presentation = useMemo(() => ({ key: presentationKey, clock }), [presentationKey, clock]);
  const presentationRef = useRef<{ presentation: typeof presentation; laidOut: boolean;
    timer: ReturnType<typeof createPresentationTimer>; frame: number | null; alive: boolean } | null>(null);
  const [ready, setReady] = useState<{ presentation: typeof presentation; active: boolean } | null>(null);
  const canInteract = useCallback(() => Boolean(presentation.key &&
    presentationRef.current?.presentation === presentation && presentationRef.current.alive && presentationRef.current.laidOut &&
    lifecycle.current.appState === 'active' && lifecycle.current.focused &&
    !lifecycle.current.appBlurred && !lifecycle.current.transitioning && navigation.isFocused()), [navigation, presentation]);

  const cancelFrame = useCallback(() => {
    const current = presentationRef.current;
    if (current?.presentation !== presentation) return;
    if (current.frame !== null) cancelAnimationFrame(current.frame);
    current.frame = null;
  }, [presentation]);
  const requestPresentation = useCallback(() => {
    const current = presentationRef.current;
    if (!canInteract() || !current || current.frame !== null) return;
    current.frame = requestAnimationFrame(() => {
      current.frame = null;
      if (!canInteract()) return;
      try {
        current.timer.start();
        setReady({ presentation, active: true });
      } catch {
        // Unavailable clock cannot produce a fabricated attempt. Actions stay disabled.
        setReady({ presentation, active: false });
      }
    });
  }, [canInteract, presentation]);

  useLayoutEffect(() => {
    const previous = presentationRef.current;
    // Timer ownership is a lifecycle boundary, not a render memoization hint.
    // React Compiler can otherwise cache the mutable timer by clock alone.
    const timer = previous?.presentation === presentation
      ? previous.timer : createPresentationTimer(presentation.clock);
    const current = { presentation, timer, laidOut: false, frame: null as number | null, alive: true };
    presentationRef.current = current;
    lifecycle.current.appState = AppState.currentState;
    lifecycle.current.focused = navigation.isFocused();
    const interrupt = (reason: TimingInterruption) => {
      current.timer.interrupt(reason);
      cancelFrame();
      setReady({ presentation, active: false });
    };
    const onAppState = (state: AppStateStatus) => {
      const previous = lifecycle.current.appState;
      lifecycle.current.appState = state;
      if (state !== 'active' && state !== previous) {
        interrupt(state === 'inactive' ? 'app_inactive' : state === 'background' ? 'app_background' : 'app_state_unknown');
      }
      if (state === 'active') requestPresentation();
    };
    const subscriptions = [
      AppState.addEventListener('change', onAppState),
      AppState.addEventListener('blur', () => {
        if (!lifecycle.current.appBlurred) interrupt('app_blur');
        lifecycle.current.appBlurred = true;
      }),
      AppState.addEventListener('focus', () => {
        lifecycle.current.appBlurred = false; requestPresentation();
      }),
    ];
    const unsubscribe = [
      navigation.addListener('blur', () => {
        if (lifecycle.current.focused) interrupt('screen_blur');
        lifecycle.current.focused = false;
      }),
      navigation.addListener('focus', () => {
        lifecycle.current.focused = true; requestPresentation();
      }),
      navigation.addListener('transitionStart', () => {
        if (!lifecycle.current.transitioning) interrupt('navigation_transition');
        lifecycle.current.transitioning = true;
      }),
      navigation.addListener('transitionEnd', () => {
        lifecycle.current.transitioning = false; requestPresentation();
      }),
      navigation.addListener('beforeRemove', () => {
        interrupt('navigation_away');
        // If another handler cancels removal, the same timer remains usable.
        requestPresentation();
      }),
    ];
    return () => {
      current.alive = false;
      cancelFrame();
      subscriptions.forEach((subscription) => subscription.remove());
      unsubscribe.forEach((remove) => remove());
    };
  }, [cancelFrame, navigation, presentation, requestPresentation]);

  const onPromptLayout = useCallback((event: LayoutChangeEvent) => {
    const current = presentationRef.current;
    if (current?.presentation !== presentation || !current.alive || !presentation.key) return;
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    current.laidOut = true;
    requestPresentation();
  }, [presentation, requestPresentation]);

  return {
    onPromptLayout,
    isInteractable: ready?.presentation === presentation && ready.active,
    commit: () => {
      const current = presentationRef.current;
      if (!canInteract() || current?.presentation !== presentation) throw new Error('Review prompt is not active.');
      return current.timer.commit();
    },
  };
}
