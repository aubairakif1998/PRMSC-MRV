import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from './ui/text';

type Props = {
  visible: boolean;
  title: string;
  options: string[];
  onClose: () => void;
  onSelect: (option: string) => void;
  searchPlaceholder?: string;
};

export function SearchablePickerModal({
  visible,
  title,
  options,
  onClose,
  onSelect,
  searchPlaceholder = 'Search…',
}: Props) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible, title]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={styles.card}>
          <Text className="mb-2 text-base font-bold text-foreground">{title}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.search}
          />
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {filtered.length === 0 ? (
              <Text className="py-4 text-center text-sm text-muted-foreground">No matches</Text>
            ) : (
              filtered.map((opt, idx) => (
                <Pressable
                  key={`${opt}-${idx}`}
                  style={styles.item}
                  onPress={() => {
                    onSelect(opt);
                    onClose();
                  }}
                >
                  <Text className="text-foreground">{opt}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    zIndex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    maxHeight: '85%',
  },
  search: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  scroll: {
    maxHeight: 320,
  },
  item: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
});
