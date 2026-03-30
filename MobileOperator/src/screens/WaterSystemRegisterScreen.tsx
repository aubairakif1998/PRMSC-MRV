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

import { createWaterSystem, getWaterSystemConfig } from '../api/operator';
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
  isValidOptionalPositiveDecimal,
  isValidPositiveDecimal,
  sanitizePositiveDecimalInput,
} from '../utils/formValidation';

type Props = NativeStackScreenProps<RootStackParamList, 'WaterSystemRegister'>;

type FormData = {
  tehsil: string;
  village: string;
  settlement: string;
  pump_model: string;
  pump_serial_number: string;
  start_of_operation: string;
  depth_of_water_intake: string;
  height_to_ohr: string;
  pump_flow_rate: string;
  meter_model: string;
  meter_serial_number: string;
  meter_accuracy_class: string;
  calibration_requirement: string;
  installation_date: string;
};

const INITIAL: FormData = {
  tehsil: '',
  village: '',
  settlement: '',
  pump_model: '',
  pump_serial_number: '',
  start_of_operation: '',
  depth_of_water_intake: '',
  height_to_ohr: '',
  pump_flow_rate: '',
  meter_model: '',
  meter_serial_number: '',
  meter_accuracy_class: '',
  calibration_requirement: '',
  installation_date: '',
};

const REQUIRED: Array<keyof FormData> = [
  'tehsil',
  'village',
  'pump_model',
  'pump_serial_number',
  'pump_flow_rate',
  'installation_date',
  'start_of_operation',
  'meter_model',
  'meter_serial_number',
  'meter_accuracy_class',
];

const LABELS: Record<keyof FormData, string> = {
  tehsil: 'Tehsil',
  village: 'Village',
  settlement: 'Settlement',
  pump_model: 'Pump Model',
  pump_serial_number: 'Pump Serial Number',
  start_of_operation: 'Operation Start',
  depth_of_water_intake: 'Intake Depth',
  height_to_ohr: 'Height to OHR',
  pump_flow_rate: 'Flow Rate',
  meter_model: 'Meter Model',
  meter_serial_number: 'Meter Serial Number',
  meter_accuracy_class: 'Accuracy Class',
  calibration_requirement: 'Calibration Notes',
  installation_date: 'Installation Date',
};

type PickerState = { title: string; field: 'tehsil' | 'village' | 'settlement'; options: string[] };

export function WaterSystemRegisterScreen({ navigation }: Props) {
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
      const result = (await getWaterSystemConfig(
        next.tehsil,
        next.village,
        next.settlement || '',
      )) as { exists?: boolean; config?: unknown };
      if (result.exists && result.config) {
        Alert.alert('Location', 'This location is already registered.');
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
    if (name === 'pump_flow_rate' || name === 'depth_of_water_intake' || name === 'height_to_ohr') {
      v = sanitizePositiveDecimalInput(value);
    }
    if (name === 'installation_date' || name === 'start_of_operation') {
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
    if (!isValidPositiveDecimal(formData.pump_flow_rate)) {
      Alert.alert(
        'Invalid value',
        `${LABELS.pump_flow_rate} must be a positive number (digits and optional decimal).`,
      );
      return false;
    }
    if (!isValidOptionalPositiveDecimal(formData.depth_of_water_intake)) {
      Alert.alert(
        'Invalid value',
        `${LABELS.depth_of_water_intake} must be empty or a positive number.`,
      );
      return false;
    }
    if (!isValidOptionalPositiveDecimal(formData.height_to_ohr)) {
      Alert.alert(
        'Invalid value',
        `${LABELS.height_to_ohr} must be empty or a positive number.`,
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
    if (!isValidIsoDate(formData.start_of_operation)) {
      Alert.alert(
        'Invalid date',
        `${LABELS.start_of_operation} must be a valid calendar date in YYYY-MM-DD format.`,
      );
      return false;
    }
    if (!isIsoDatePastOrToday(formData.start_of_operation)) {
      Alert.alert(
        'Invalid date',
        `${LABELS.start_of_operation} cannot be in the future. Use today or an earlier date.`,
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
      const minOk = formData.tehsil && formData.village;
      if (!minOk) {
        Alert.alert('Draft', 'Tehsil and village are required to save a draft.');
        return;
      }
    }
    setLoading(true);
    try {
      await createWaterSystem({ ...formData, status });
      Alert.alert('Success', status === 'draft' ? 'Draft saved.' : 'Registration complete.', [
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
            <CardTitle>Water system registration</CardTitle>
            <CardDescription>
              Same fields as web: location, equipment, and metering. Settlement is optional.
            </CardDescription>
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

            <Field label={LABELS.pump_model} value={formData.pump_model} onChangeText={(t) => setField('pump_model', t)} />
            <Field
              label={LABELS.pump_serial_number}
              value={formData.pump_serial_number}
              onChangeText={(t) => setField('pump_serial_number', t)}
            />
            <Field
              label={LABELS.pump_flow_rate}
              value={formData.pump_flow_rate}
              onChangeText={(t) => setField('pump_flow_rate', t)}
              keyboardType="decimal-pad"
            />
            <DatePickerField
              label={LABELS.installation_date}
              value={formData.installation_date}
              onChange={(iso) => setField('installation_date', iso)}
              placeholder="Tap to select (today or earlier)"
            />
            <DatePickerField
              label={LABELS.start_of_operation}
              value={formData.start_of_operation}
              onChange={(iso) => setField('start_of_operation', iso)}
              placeholder="Tap to select (today or earlier)"
            />
            <Field
              label={LABELS.depth_of_water_intake}
              value={formData.depth_of_water_intake}
              onChangeText={(t) => setField('depth_of_water_intake', t)}
              keyboardType="decimal-pad"
            />
            <Field
              label={LABELS.height_to_ohr}
              value={formData.height_to_ohr}
              onChangeText={(t) => setField('height_to_ohr', t)}
              keyboardType="decimal-pad"
            />
            <Field label={LABELS.meter_model} value={formData.meter_model} onChangeText={(t) => setField('meter_model', t)} />
            <Field
              label={LABELS.meter_serial_number}
              value={formData.meter_serial_number}
              onChangeText={(t) => setField('meter_serial_number', t)}
            />
            <Field
              label={LABELS.meter_accuracy_class}
              value={formData.meter_accuracy_class}
              onChangeText={(t) => setField('meter_accuracy_class', t)}
            />
            <Field
              label={LABELS.calibration_requirement}
              value={formData.calibration_requirement}
              onChangeText={(t) => setField('calibration_requirement', t)}
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
