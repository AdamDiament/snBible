import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

/**
 * E-ink design rules used throughout:
 * - Pure black on white; one mid grey for secondary text; one light grey for selection fill.
 * - No animation, no ripples, no shadows (they ghost on e-paper).
 * - Large, bordered tap targets; selection shown with weight + fill, never colour.
 * - Scripture is set in a serif; controls in the system sans.
 */
export const C = {
  ink: '#000000',
  paper: '#FFFFFF',
  grey: '#5E5E5E',
  rule: '#9A9A9A',
  fill: '#DCDCDC',
};

export const T = {
  serif: 'serif',
  body: 22,
  small: 18,
  label: 20,
  title: 30,
};

type BtnProps = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'plain' | 'quiet';
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, kind = 'plain', disabled, style }: BtnProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      android_disableSound
      style={[
        s.btn,
        kind === 'primary' && s.btnPrimary,
        kind === 'quiet' && s.btnQuiet,
        disabled && s.btnDisabled,
        style,
      ]}>
      <Text style={[s.btnText, kind === 'primary' && s.btnTextPrimary, disabled && s.btnTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

/** A segmented choice: one row of options, the chosen one filled black. */
export function Choice<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: Array<[V, string]>;
  onChange: (v: V) => void;
}) {
  return (
    <View style={s.choiceRow}>
      <Text style={s.choiceLabel}>{label}</Text>
      <View style={s.segments}>
        {options.map(([v, text], i) => {
          const on = v === value;
          return (
            <Pressable
              key={v}
              onPress={() => onChange(v)}
              style={[s.segment, i > 0 && s.segmentJoin, on && s.segmentOn]}>
              <Text style={[s.segmentText, on && s.segmentTextOn]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={s.toggle}>
      <View style={[s.box, value && s.boxOn]}>{value ? <Text style={s.tick}>✓</Text> : null}</View>
      <Text style={s.toggleText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    minHeight: 64,
    paddingHorizontal: 22,
    borderWidth: 2,
    borderColor: C.ink,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.paper,
  },
  btnPrimary: { backgroundColor: C.ink },
  btnQuiet: { borderColor: C.paper },
  btnDisabled: { borderColor: C.rule },
  btnText: { fontSize: T.label, color: C.ink, fontWeight: '600' },
  btnTextPrimary: { color: C.paper },
  btnTextDisabled: { color: C.rule },

  choiceRow: { marginBottom: 18 },
  choiceLabel: { fontSize: T.small, color: C.grey, marginBottom: 8 },
  segments: { flexDirection: 'row', borderWidth: 2, borderColor: C.ink, borderRadius: 6, overflow: 'hidden' },
  segment: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  segmentJoin: { borderLeftWidth: 2, borderLeftColor: C.ink },
  segmentOn: { backgroundColor: C.ink },
  segmentText: { fontSize: T.small, color: C.ink },
  segmentTextOn: { color: C.paper, fontWeight: '700' },

  toggle: { flexDirection: 'row', alignItems: 'center', minHeight: 56, marginRight: 28 },
  box: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: C.ink,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  boxOn: { backgroundColor: C.ink },
  tick: { color: C.paper, fontSize: 22, fontWeight: '700' },
  toggleText: { fontSize: T.small, color: C.ink },
});
