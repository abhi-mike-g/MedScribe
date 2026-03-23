/**
 * MedScribe Native AI Provider — Unified interface
 * 
 * Orchestrates both Whisper STT and Phi-3 LLM bridges.
 * Provides status reporting and platform detection.
 */

import { Platform } from 'react-native';
import { transcribeAudio, getSTTStatus, type WhisperSTTResult } from './WhisperBridge';
import { extractMedicalData, getLLMStatus, type LLMExtractionResult } from './Phi3Bridge';

export { transcribeAudio, extractMedicalData };
export type { WhisperSTTResult, LLMExtractionResult };

export interface NativeAIStatus {
  platform: string;
  isWebPreview: boolean;
  stt: {
    isNativeAvailable: boolean;
    modelLoaded: boolean;
    backend: string;
    modelName: string;
    modelSize: string;
  };
  llm: {
    isNativeAvailable: boolean;
    modelLoaded: boolean;
    backend: string;
    modelName: string;
    modelSize: string;
  };
  hardwareAcceleration: string[];
  memoryEstimate: string;
}

export function getNativeAIStatus(): NativeAIStatus {
  const sttStatus = getSTTStatus();
  const llmStatus = getLLMStatus();
  const isWeb = Platform.OS === 'web';

  return {
    platform: Platform.OS,
    isWebPreview: isWeb,
    stt: {
      ...sttStatus,
      modelName: 'whisper-cpp-base.en',
      modelSize: '~57MB (INT8 quantized)',
    },
    llm: {
      ...llmStatus,
      modelName: 'phi-3-mini-4k-instruct',
      modelSize: '~2.3GB (Q4_K_M)',
    },
    hardwareAcceleration: isWeb
      ? ['None (web preview — mock inference)']
      : ['NNAPI', 'GPU Delegate (Adreno/Mali)', 'XNNPACK'],
    memoryEstimate: isWeb
      ? 'N/A (web preview)'
      : '~3.5GB total (STT: ~200MB, LLM: ~3GB)',
  };
}

/**
 * Format the AI status for display in the UI
 */
export function getStatusBadges(): Array<{
  label: string;
  value: string;
  color: 'green' | 'blue' | 'yellow';
}> {
  const status = getNativeAIStatus();
  const badges = [];

  if (status.isWebPreview) {
    badges.push({
      label: 'MODE',
      value: 'Web Preview (Mock AI)',
      color: 'yellow' as const,
    });
  } else {
    badges.push({
      label: 'MODE',
      value: 'On-Device Inference',
      color: 'green' as const,
    });
  }

  badges.push({
    label: 'STT',
    value: status.stt.modelName,
    color: status.stt.isNativeAvailable ? 'green' as const : 'blue' as const,
  });

  badges.push({
    label: 'LLM',
    value: status.llm.modelName,
    color: status.llm.isNativeAvailable ? 'green' as const : 'blue' as const,
  });

  return badges;
}
