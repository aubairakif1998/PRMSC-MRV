import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Label } from './ui/label';
import { Text } from './ui/text';

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** Parse 24h time string (e.g. `06:30`, `14:00:00`) into 12h clock parts. */
export function parse24hTimeToParts(s: string): {
  h12: number;
  minute: number;
  meridiem: 'AM' | 'PM';
} {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return { h12: 9, minute: 0, meridiem: 'AM' };
  const h24 = parseInt(m[1], 10) % 24;
  const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const meridiem: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h12, minute, meridiem };
}

/** Build `HH:MM:00` for API / pump_time parsing. */
export function partsTo24hTime(
  h12: number,
  minute: number,
  meridiem: 'AM' | 'PM',
): string {
  let h24: number;
  if (meridiem === 'AM') {
    h24 = h12 === 12 ? 0 : h12;
  } else {
    h24 = h12 === 12 ? 12 : h12 + 12;
  }
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

/** e.g. `9:05 AM` */
export function formatAmPmDisplay(time24: string): string {
  if (!time24.trim()) return '';
  const { h12, minute, meridiem } = parse24hTimeToParts(time24);
  return `${h12}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

/** Normalize any parseable 24h fragment to `HH:MM:00` for the API. */
export function normalizeTo24hWithSeconds(s: string): string {
  const t = s.trim();
  if (!t) return '';
  const p = parse24hTimeToParts(t);
  return partsTo24hTime(p.h12, p.minute, p.meridiem);
}

type Props = {
  label: string;
  /** 24h time `HH:MM` or `HH:MM:SS`; empty = not set */
  value: string;
  onChange: (time24: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function AmPmTimePickerField({
  label,
  value,
  onChange,
  placeholder = 'Tap to select',
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [h12, setH12] = useState(9);
  const [minute, setMinute] = useState(0);
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>('AM');

  const displayText = useMemo(
    () => (value.trim() ? formatAmPmDisplay(value) : ''),
    [value],
  );

  const openModal = useCallback(() => {
    if (disabled) return;
    if (value.trim()) {
      const p = parse24hTimeToParts(value);
      setH12(p.h12);
      setMinute(p.minute);
      setMeridiem(p.meridiem);
    } else {
      setH12(9);
      setMinute(0);
      setMeridiem('AM');
    }
    setOpen(true);
  }, [value, disabled]);

  const commit = useCallback(() => {
    onChange(partsTo24hTime(h12, minute, meridiem));
    setOpen(false);
  }, [h12, minute, meridiem, onChange]);

  return (
    <View className="gap-2">
      {label ? (
        <Label className="text-muted-foreground">{label}</Label>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || 'Select time'}
        onPress={openModal}
        disabled={disabled}
        className={`border-input bg-background min-h-12 justify-center rounded-md border px-3 py-2 ${
          disabled ? 'opacity-60' : 'active:bg-muted/80'
        }`}
      >
        <Text
          className={`text-base ${displayText ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {displayText || placeholder}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
          />
          <View style={styles.sheet}>
            <View style={styles.toolbar}>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.toolbarBtn}>Cancel</Text>
              </Pressable>
              <Text style={styles.toolbarTitle} numberOfLines={1}>
                {label || 'Time'}
              </Text>
              <Pressable onPress={commit} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.toolbarBtn, styles.toolbarDone]}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>Scroll hour, minute, and AM / PM</Text>
            <View style={styles.columns}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Hour</Text>
                <FlatList
                  data={HOURS_12}
                  keyExtractor={(item) => String(item)}
                  style={styles.list}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={Platform.OS === 'android'}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.cell,
                        item === h12 && styles.cellSelected,
                      ]}
                      onPress={() => setH12(item)}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          item === h12 && styles.cellTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Min</Text>
                <FlatList
                  data={MINUTES}
                  keyExtractor={(item) => String(item)}
                  style={styles.list}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={Platform.OS === 'android'}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.cell,
                        item === minute && styles.cellSelected,
                      ]}
                      onPress={() => setMinute(item)}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          item === minute && styles.cellTextSelected,
                        ]}
                      >
                        {String(item).padStart(2, '0')}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>AM / PM</Text>
                <FlatList
                  data={['AM', 'PM']}
                  keyExtractor={(item) => item}
                  style={styles.list}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={Platform.OS === 'android'}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.cell,
                        item === meridiem && styles.cellSelected,
                      ]}
                      onPress={() => setMeridiem(item)}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          item === meridiem && styles.cellTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    zIndex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    maxHeight: '72%',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  toolbarBtn: {
    fontSize: 17,
    color: '#2563eb',
  },
  toolbarDone: {
    fontWeight: '600',
  },
  toolbarTitle: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  columns: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  col: {
    flex: 1,
    marginHorizontal: 4,
  },
  colLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 6,
  },
  list: {
    height: 220,
  },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    marginVertical: 2,
  },
  cellSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  cellText: {
    fontSize: 15,
    color: '#0f172a',
    textAlign: 'center',
  },
  cellTextSelected: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
});
