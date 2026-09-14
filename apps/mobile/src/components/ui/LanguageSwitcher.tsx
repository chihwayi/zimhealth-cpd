import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { setLanguage } from '../../i18n';
import { BG, SURFACE, BORDER, BORDER2, TEXT, TEXT2, ACCENT, ACCENT_BG } from '../../theme';

interface LocaleOption {
  code: string;
  name: string;
  countryCodes: string[];
}

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const localesQuery = useQuery<{ locales: LocaleOption[] }>({
    queryKey: ['available-locales'],
    queryFn: () => api.get('/api/locales'),
    staleTime: 1000 * 60 * 10,
  });

  const options: LocaleOption[] = [
    { code: 'en', name: 'English', countryCodes: [] },
    ...(localesQuery.data?.locales ?? []),
  ];

  const current = options.find((o) => o.code === i18n.language) ?? options[0];

  return (
    <>
      <Pressable style={s.row} onPress={() => setOpen(true)}>
        <View style={s.rowLeft}>
          <Ionicons name="language" size={18} color={TEXT2} />
          <Text style={s.rowLabel}>Language</Text>
        </View>
        <View style={s.rowRight}>
          <Text style={s.rowValue}>{current.name}</Text>
          <Ionicons name="chevron-forward" size={16} color={TEXT2} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={() => null}>
            <Text style={s.sheetTitle}>Choose a language</Text>
            <View style={s.optionsList}>
              {options.map((option) => {
                const active = option.code === i18n.language;
                return (
                  <Pressable
                    key={option.code}
                    style={[s.option, active && s.optionActive]}
                    onPress={() => {
                      setLanguage(option.code);
                      setOpen(false);
                    }}
                  >
                    <Text style={[s.optionLabel, active && s.optionLabelActive]}>{option.name}</Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={ACCENT} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: TEXT },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, color: TEXT2 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: BORDER2,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 14,
  },
  optionsList: { gap: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  optionActive: {
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
  },
  optionLabel: { fontSize: 14, fontWeight: '600', color: TEXT2 },
  optionLabelActive: { color: TEXT },
});
