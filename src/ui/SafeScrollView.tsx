import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, ScrollViewProps } from 'react-native';

/**
 * Bumped by App each time the host shows the plugin again. Every SafeScrollView
 * remounts when it changes, dropping any gesture state left over from last time.
 */
export const ResumeKey = createContext(0);

// Longer than any real fling on e-ink; after this we assume the end event was lost.
const MOMENTUM_WATCHDOG_MS = 2000;

/**
 * A ScrollView that can't get stuck swallowing taps.
 *
 * RN's ScrollView claims every touch on its children while it believes a fling is
 * still running (momentum-begin seen, momentum-end not yet) or while it believes the
 * soft keyboard is up. If the host hides the plugin mid-fling, or the keyboard state
 * goes stale across hide/show, the end event never comes and every tap inside the list
 * is eaten, while buttons outside it keep working. That matched the "chapter won't open"
 * freeze seen on device. So:
 *  - keyboardShouldPersistTaps="handled" lets taps reach buttons whatever the keyboard state;
 *  - if a fling never reports ending, remount at the same scroll position;
 *  - remount whenever the plugin is shown again (ResumeKey).
 */
export function SafeScrollView({ children, onScroll, onMomentumScrollBegin, onMomentumScrollEnd, ...rest }: ScrollViewProps) {
  const resume = useContext(ResumeKey);
  const [generation, setGeneration] = useState(0);
  const y = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopWatchdog = () => {
    if (watchdog.current) {
      clearTimeout(watchdog.current);
      watchdog.current = null;
    }
  };
  useEffect(() => stopWatchdog, []);

  const key = `${resume}:${generation}`;
  // Captured when the key changes, so a remount comes back where the reader was.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const restore = useMemo(() => ({ x: 0, y: y.current }), [key]);

  return (
    <ScrollView
      key={key}
      keyboardShouldPersistTaps="handled"
      contentOffset={restore}
      scrollEventThrottle={100}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        y.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      onMomentumScrollBegin={e => {
        stopWatchdog();
        watchdog.current = setTimeout(() => {
          watchdog.current = null;
          setGeneration(g => g + 1);
        }, MOMENTUM_WATCHDOG_MS);
        onMomentumScrollBegin?.(e);
      }}
      onMomentumScrollEnd={e => {
        stopWatchdog();
        onMomentumScrollEnd?.(e);
      }}
      {...rest}>
      {children}
    </ScrollView>
  );
}
