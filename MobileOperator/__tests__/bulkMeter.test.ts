import {
  bulkMeterOrderErrorMessage,
  formatMeterM3,
  maxSubmittedMeterEndFromRows,
} from '../src/utils/bulkMeter';

describe('formatMeterM3', () => {
  it('formats with up to two decimal places', () => {
    expect(formatMeterM3(57082)).toMatch(/57,?082/);
    expect(formatMeterM3(1234.5)).toMatch(/1,?234\.5/);
  });
});

describe('maxSubmittedMeterEndFromRows', () => {
  it('returns max meter_reading_end from submitted rows', () => {
    const rows = [
      { status: 'submitted', meter_reading_end: 100 },
      { status: 'accepted', meter_reading_end: 250 },
      { status: 'drafted', meter_reading_end: 999 },
      { status: 'rejected', meter_reading_end: 50 },
    ];
    expect(maxSubmittedMeterEndFromRows(rows)).toBe(250);
  });

  it('ignores rows without meter_reading_end', () => {
    const rows = [
      { status: 'submitted', total_water_pumped: 40 },
      { status: 'submitted', meter_reading_end: null },
    ];
    expect(maxSubmittedMeterEndFromRows(rows)).toBeNull();
  });
});

describe('bulkMeterOrderErrorMessage', () => {
  it('requires pump-stop above initial reading on first log', () => {
    expect(
      bulkMeterOrderErrorMessage({
        isFirstBulkMeterLog: true,
        meterReadingStart: '100',
        meterReadingEnd: '100',
        previousMeterReadingEnd: null,
      }),
    ).toContain('initial reading');
  });

  it('requires pump-stop above previous submitted end', () => {
    expect(
      bulkMeterOrderErrorMessage({
        isFirstBulkMeterLog: false,
        meterReadingStart: '',
        meterReadingEnd: '57080',
        previousMeterReadingEnd: 57082,
      }),
    ).toContain('last submitted pump-stop reading');
  });

  it('returns null when reading is valid', () => {
    expect(
      bulkMeterOrderErrorMessage({
        isFirstBulkMeterLog: false,
        meterReadingStart: '',
        meterReadingEnd: '57100',
        previousMeterReadingEnd: 57082,
      }),
    ).toBeNull();
  });
});
