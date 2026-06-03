import { STORAGE_KEYS } from '../storage/keys';
import { getJson, setJson } from '../storage/jsonStorage';
import { nowIsoTimestamp } from '../utils/pakistanTime';

type SignatureCache = {
  hasSignature: boolean;
  checkedAt: string;
};

export async function getSignatureCache(): Promise<SignatureCache | null> {
  return await getJson<SignatureCache>(STORAGE_KEYS.signature);
}

export async function setSignatureCache(hasSignature: boolean): Promise<void> {
  await setJson<SignatureCache>(STORAGE_KEYS.signature, {
    hasSignature,
    checkedAt: nowIsoTimestamp(),
  });
}

