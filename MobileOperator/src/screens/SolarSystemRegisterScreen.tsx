import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  type TextInputProps,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { createSolarSystem, getSolarSystemConfig } from '../api/operator';
import { DatePickerField } from '../components/DatePickerField';
import { SearchablePickerModal } from '../components/SearchablePickerModal';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Text } from '../components/ui/text';
import { getApiErrorMessage } from '../lib/api-error';
import type { RootStackParamList } from '../navigation/types';
import { LOCATION_DATA, SETTLEMENT_DATA, TEHSIL_OPTIONS } from '../utils/locationData';
import {
  clampIsoDateToMax,
  getLocalIsoDateString,
  isIsoDatePastOrToday,
  isValidIsoDate,
  isValidPositiveDecimal,
  sanitizePositiveDecimalInput,
} from '../utils/formValidation';

type Props = NativeStackScreenProps<RootStackParamList, 'SolarSystemRegister'>;

type FormData = {
  tehsil: string;
  village: string;
  settlement: string;
  installation_location: string;
  solar_panel_capacity: string;
  inverter_capacity: string;
  inverter_serial_number: string;
  installation_date: string;
  meter_model: string;
  meter_serial_number: string;
  green_meter_connection_date: string;
  calibration_date: string;
  remarks: string;
};

const INITIAL: FormData = {
  tehsil: '',
  village: '',
  settlement: '',
  installation_location: '',
  solar_panel_capacity: '',
  inverter_capacity: '',
  inverter_serial_number: '',
  installation_date: '',
  meter_model: '',
  meter_serial_number: '',
  green_meter_connection_date: '',
  calibration_date: '',
  remarks: '',
};

const REQUIRED: Array<keyof FormData> = [
  'tehsil',
  'village',
  'installation_location',
  'solar_panel_capacity',
  'inverter_capacity',
  'inverter_serial_number',
  'installation_date',
  'meter_model',
  'meter_serial_number',
  'green_meter_connection_date',
];

const LABELS: Record<keyof FormData, string> = {
  tehsil: 'Tehsil',
  village: 'Village',
  settlement: 'Settlement',
  installation_location: 'Installation Type',
  solar_panel_capacity: 'PV Capacity (kWp)',
  inverter_capacity: 'Inverter Capacity (kVA)',
  inverter_serial_number: 'Inverter Serial',
  installation_date: 'Commissioning Date',
  meter_model: 'Meter Model',
  meter_serial_number: 'Meter Serial',
  green_meter_connection_date: 'Green Meter Connection Date',
  calibration_date: 'Calibration Date',
  remarks: 'Technical Remarks',
};

type PickerState = { title: string; field: 'tehsil' | 'village' | 'settlement'; options: string[] };

export function SolarSystemRegisterScreen({ navigation }: Props) {
  const [formData, setFormData] = useState<FormData>(INITIAL);
  const [systemExists, setSystemExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);

  const villageOptions = useMemo(() => {
    if (!formData.tehsil) return [];
    return LOCATION_DATA[formData.tehsil] ?? [];
  }, [formData.tehsil]);

  const settlementOptions = useMemo(() => {
    if (!formData.village) return [];
    return SETTLEMENT_DATA[formData.village] ?? [];
  }, [formData.village]);

  const checkLocation = useCallback(async (next: FormData) => {
    if (!next.tehsil || !next.village) {
      setSystemExists(false);
      return;
    }
    try {
      const result = (await getSolarSystemConfig(
        next.tehsil,
        next.village,
        next.settlement || '',
      )) as { exists?: boolean; config?: unknown };
      if (result.exists && result.config) {
        Alert.alert('Location', 'Location already has an active solar site.');
        setSystemExists(true);
      } else {
        setSystemExists(false);
      }
    } catch (e: unknown) {
      setSystemExists(false);
      Alert.alert('Validation', getApiErrorMessage(e, 'Failed to validate location'));
    }
  }, []);

  const setField = (name: keyof FormData, value: string) => {
    let v = value;
    if (name === 'solar_panel_capacity' || name === 'inverter_capacity') {
      v = sanitizePositiveDecimalInput(value);
    }
    if (
      name === 'installation_date' ||
      name === 'green_meter_connection_date' ||
      name === 'calibration_date'
    ) {
      v = value;
      const today = getLocalIsoDateString();
      if (v.length === 10 && isValidIsoDate(v)) {
        v = clampIsoDateToMax(v, today);
      }
    }
    let next = { ...formData, [name]: v };
    if (name === 'tehsil') {
      next = { ...next, village: '', settlement: '' };
    } else if (name === 'village') {
      next = { ...next, settlement: '' };
    }
    setFormData(next);
    if (name === 'tehsil' || name === 'village' || name === 'settlement') {
      checkLocation(next).catch(() => {});
    }
  };

  const validate = (): boolean => {
    const missing = REQUIRED.filter((k) => !String(formData[k]).trim());
    if (missing.length) {
      Alert.alert(
        'Required fields',
        `Complete: ${missing.map((k) => LABELS[k]).join(', ')}`,
      );
      return false;
    }
    if (!isValidPositiveDecimal(formData.solar_panel_capacity)) {
      Alert.alert(
        'Invalid value',
        `${LABELS.solar_panel_capacity} must be a positive number (digits and optional decimal).`,
      );
      return false;
    }
    if (!isValidPositiveDecimal(formData.inverter_capacity)) {
      Alert.alert(
        'Invalid value',
        `${LABELS.inverter_capacity} must be a positive number (digits and optional decimal).`,
      );
      return false;
    }
    if (!isValidIsoDate(formData.installation_date)) {
      Alert.alert(
        'Invalid date',
        `${LABELS.installation_date} must be a valid calendar date in YYYY-MM-DD format.`,
      );
      return false;
    }
    if (!isIsoDatePastOrToday(formData.installation_date)) {
      Alert.alert(
        'Invalid date',
        `${LABELS.installation_date} cannot be in the future. Use today or an earlier date.`,
      );
      return false;
    }
    if (!isValidIsoDate(formData.green_meter_connection_date)) {
      Alert.alert(
        'Invalid date',
        `${LABELS.green_meter_connection_date} must be a valid calendar date in YYYY-MM-DD format.`,
      );
      return false;
    }
    if (!isIsoDatePastOrToday(formData.green_meter_connection_date)) {
      Alert.alert(
        'Invalid date',
        `${LABELS.green_meter_connection_date} cannot be in the future. Use today or an earlier date.`,
      );
      return false;
    }
    if (formData.calibration_date.trim() && !isValidIsoDate(formData.calibration_date)) {
      Alert.alert(
        'Invalid date',
        `${LABELS.calibration_date} must be empty or a valid calendar date in YYYY-MM-DD format.`,
      );
      return false;
    }
    if (formData.calibration_date.trim() && !isIsoDatePastOrToday(formData.calibration_date)) {
      Alert.alert(
        'Invalid date',
        `${LABELS.calibration_date} cannot be in the future. Use today or an earlier date.`,
      );
      return false;
    }
    if (systemExists) {
      Alert.alert('Cannot submit', 'Resolve duplicate location first.');
      return false;
    }
    return true;
  };

  const submit = async (status: 'draft' | 'submitted') => {
    if (status === 'submitted' && !validate()) return;
    if (status === 'draft') {
      if (!formData.tehsil || !formData.village) {
        Alert.alert('Draft', 'Tehsil and village are required to save a draft.');
        return;
      }
    }
    setLoading(true);
    try {
      await createSolarSystem({ ...formData, status });
      Alert.alert('Success', status === 'draft' ? 'Draft saved.' : 'Site registered.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    } catch (e: unknown) {
      const message = getApiErrorMessage(e, 'Registration failed');
      Alert.alert('Could not save', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-muted/30"
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pt-4"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <CardHeader>
            <CardTitle>Solar system registration</CardTitle>
            <CardDescription>Aligned with web SolarSystemForm required fields.</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <SelectRow
              label="Tehsil"
              value={formData.tehsil}
              placeholder="Select Tehsil"
              onPress={() =>
                setPicker({ title: 'Tehsil', field: 'tehsil', options: [...TEHSIL_OPTIONS] })
              }
            />
            <SelectRow
              label="Village"
              value={formData.village}
              placeholder="Select Village"
              onPress={() =>
                setPicker({
                  title: 'Village',
                  field: 'village',
                  options: villageOptions,
                })
              }
            />
            <SelectRow
              label="Settlement (optional)"
              value={formData.settlement}
              placeholder="Select Settlement"
              onPress={() =>
                setPicker({
                  title: 'Settlement',
                  field: 'settlement',
                  options: settlementOptions,
                })
              }
            />
            <Field
              label={LABELS.installation_location}
              value={formData.installation_location}
              onChangeText={(t) => setField('installation_location', t)}
              placeholder="Ground mounted, rooftop, etc."
            />
            <Field
              label={LABELS.solar_panel_capacity}
              value={formData.solar_panel_capacity}
              onChangeText={(t) => setField('solar_panel_capacity', t)}
              keyboardType="decimal-pad"
            />
            <Field
              label={LABELS.inverter_capacity}
              value={formData.inverter_capacity}
              onChangeText={(t) => setField('inverter_capacity', t)}
              keyboardType="decimal-pad"
            />
            <Field
              label={LABELS.inverter_serial_number}
              value={formData.inverter_serial_number}
              onChangeText={(t) => setField('inverter_serial_number', t)}
            />
            <DatePickerField
              label={LABELS.installation_date}
              value={formData.installation_date}
              onChange={(iso) => setField('installation_date', iso)}
              placeholder="Tap to select (today or earlier)"
            />
            <Field label={LABELS.meter_model} value={formData.meter_model} onChangeText={(t) => setField('meter_model', t)} />
            <Field
              label={LABELS.meter_serial_number}
              value={formData.meter_serial_number}
              onChangeText={(t) => setField('meter_serial_number', t)}
            />
            <DatePickerField
              label={LABELS.green_meter_connection_date}
              value={formData.green_meter_connection_date}
              onChange={(iso) => setField('green_meter_connection_date', iso)}
              placeholder="Tap to select (today or earlier)"
            />
            <DatePickerField
              label={`${LABELS.calibration_date} (optional)`}
              value={formData.calibration_date}
              onChange={(iso) => setField('calibration_date', iso)}
              placeholder="Optional — tap to choose"
              allowEmpty
            />
            <Field
              label={LABELS.remarks}
              value={formData.remarks}
              onChangeText={(t) => setField('remarks', t)}
              multiline
            />

            <View className="flex-col gap-3 sm:flex-row">
              <Button variant="outline" className="flex-1" disabled={loading} onPress={() => submit('draft')}>
                Save draft
              </Button>
              <Button className="flex-1" disabled={loading} onPress={() => submit('submitted')}>
                {loading ? 'Submitting…' : 'Submit'}
              </Button>
            </View>
          </CardContent>
        </Card>
      </ScrollView>

      <SearchablePickerModal
        visible={Boolean(picker)}
        title={picker?.title ?? ''}
        options={picker?.options ?? []}
        searchPlaceholder="Search list…"
        onClose={() => setPicker(null)}
        onSelect={(opt) => {
          if (!picker) return;
          setField(picker.field, opt);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function SelectRow({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View className="gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Pressable
        className="border-input bg-background h-12 justify-center rounded-md border px-3"
        onPress={onPress}>
        <Text className="text-foreground">{value || placeholder}</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View className="gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
      />
    </View>
  );
}
