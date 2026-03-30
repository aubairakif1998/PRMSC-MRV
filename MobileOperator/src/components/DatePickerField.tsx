import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { getLocalIsoDateString, isValidIsoDate } from '../utils/formValidation';
import { Label } from './ui/label';
import { Text } from './ui/text';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoFromParts(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseIsoParts(iso: string): { y: number; m: number; d: number } | null {
  if (!isValidIsoDate(iso)) return null;
  const t = iso.trim();
  return {
    y: parseInt(t.slice(0, 4), 10),
    m: parseInt(t.slice(5, 7), 10),
    d: parseInt(t.slice(8, 10), 10),
  };
}

function todayParts(): { y: number; m: number; d: number } {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

type Props = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
};

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Tap to select',
  allowEmpty,
}: Props) {
  const [open, setOpen] = useState(false);
  const [y, setY] = useState(() => todayParts().y);
  const [m, setM] = useState(() => todayParts().m);
  const [d, setD] = useState(() => todayParts().d);

  const maxIso = getLocalIsoDateString();
  const { y: maxY, m: maxM, d: maxD } = useMemo(() => {
    const p = parseIsoParts(maxIso);
    return p ?? todayParts();
  }, [maxIso]);

  const years = useMemo(() => {
    const start = 1990;
    const list: number[] = [];
    for (let yv = start; yv <= maxY; yv++) list.push(yv);
    return list;
  }, [maxY]);

  const dayItems = useMemo(() => {
    const cap = daysInMonth(y, m);
    const last = Math.min(cap, y === maxY && m === maxM ? maxD : cap);
    const n: number[] = [];
    for (let i = 1; i <= last; i++) n.push(i);
    return n;
  }, [y, m, maxY, maxM, maxD]);

  const openModal = useCallback(() => {
    const p = value.trim() && isValidIsoDate(value) ? parseIsoParts(value.trim()) : null;
    const t = todayParts();
    if (p) {
      let ny = p.y;
      let nm = p.m;
      let nd = p.d;
      if (ny > maxY) {
        ny = maxY;
        nm = maxM;
        nd = maxD;
      } else if (ny === maxY && nm > maxM) {
        nm = maxM;
        nd = maxD;
      } else if (ny === maxY && nm === maxM && nd > maxD) {
        nd = maxD;
      }
      const dim = daysInMonth(ny, nm);
      if (nd > dim) nd = dim;
      setY(ny);
      setM(nm);
      setD(nd);
    } else {
      setY(t.y);
      setM(t.m);
      setD(t.d);
    }
    setOpen(true);
  }, [value, maxY, maxM, maxD]);

  const commit = useCallback(() => {
    let ny = y;
    let nm = m;
    let nd = d;
    const dim = daysInMonth(ny, nm);
    if (nd > dim) nd = dim;
    let iso = isoFromParts(ny, nm, nd);
    if (iso > maxIso) {
      iso = maxIso;
    }
    onChange(iso);
    setOpen(false);
  }, [y, m, d, maxIso, onChange]);

  const displayText = value.trim() && isValidIsoDate(value) ? value.trim() : '';

  const onSetMonth = useCallback(
    (nextM: number) => {
      setM(nextM);
      const dim = daysInMonth(y, nextM);
      const capD = y === maxY && nextM === maxM ? Math.min(maxD, dim) : dim;
      if (d > capD) setD(capD);
    },
    [y, d, maxY, maxM, maxD],
  );

  const onSetYear = useCallback(
    (nextY: number) => {
      let nm = m;
      if (nextY === maxY && m > maxM) nm = maxM;
      setY(nextY);
      setM(nm);
      const dim = daysInMonth(nextY, nm);
      let nd = d;
      if (nextY === maxY && nm === maxM) nd = Math.min(d, maxD, dim);
      else nd = Math.min(d, dim);
      setD(nd);
    },
    [m, d, maxY, maxM, maxD],
  );

  return (
    <View className="gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={openModal}
        className="border-input bg-background min-h-12 justify-center rounded-md border px-3 py-2 active:bg-muted/80"
      >
        <Text className={`text-base ${displayText ? 'text-foreground' : 'text-muted-foreground'}`}>
          {displayText || placeholder}
        </Text>
      </Pressable>
      {allowEmpty && displayText ? (
        <Pressable onPress={() => onChange('')} accessibilityRole="button">
          <Text className="text-sm text-primary">Clear</Text>
        </Pressable>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityRole="button" />
          <View style={styles.sheet}>
            <View style={styles.toolbar}>
              <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.toolbarBtn}>Cancel</Text>
              </Pressable>
              <Text style={styles.toolbarTitle} numberOfLines={1}>
                {label}
              </Text>
              <Pressable onPress={commit} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.toolbarBtn, styles.toolbarDone]}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>Only today or earlier dates</Text>
            <View style={styles.columns}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Year</Text>
                <FlatList
                  data={years}
                  keyExtractor={(item) => String(item)}
                  style={styles.list}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={Platform.OS === 'android'}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.cell, item === y && styles.cellSelected]}
                      onPress={() => onSetYear(item)}
                    >
                      <Text style={[styles.cellText, item === y && styles.cellTextSelected]}>{item}</Text>
                    </Pressable>
                  )}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Month</Text>
                <FlatList
                  data={MONTH_LABELS.map((name, i) => ({ name, month: i + 1 }))}
                  keyExtractor={(it) => String(it.month)}
                  style={styles.list}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={Platform.OS === 'android'}
                  renderItem={({ item }) => {
                    const disabled = y === maxY && item.month > maxM;
                    return (
                      <Pressable
                        style={[styles.cell, item.month === m && styles.cellSelected, disabled && styles.cellDisabled]}
                        onPress={() => {
                          if (!disabled) onSetMonth(item.month);
                        }}
                        disabled={disabled}
                      >
                        <Text
                          style={[
                            styles.cellText,
                            item.month === m && styles.cellTextSelected,
                            disabled && styles.cellTextDisabled,
                          ]}
                        >
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Day</Text>
                <FlatList
                  data={dayItems}
                  keyExtractor={(item) => String(item)}
                  style={styles.list}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={Platform.OS === 'android'}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.cell, item === d && styles.cellSelected]}
                      onPress={() => setD(item)}
                    >
                      <Text style={[styles.cellText, item === d && styles.cellTextSelected]}>{item}</Text>
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
  cellDisabled: {
    opacity: 0.35,
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
  cellTextDisabled: {
    color: '#94a3b8',
  },
});
