
import React from 'react';
import { Loader } from './Loader';
import { CheckCircleIcon, ClockIcon, XCircleIcon } from './Icons';
import { ProgressState, ProgressStep } from '../App';

interface ProgressTrackerProps {
  progress: ProgressState;
}

const steps: { key: ProgressStep, label: string }[] = [
  { key: 'reading', label: 'PDF読み込み' },
  { key: 'converting', label: 'ページを画像に変換' },
  { key: 'extractingText', label: 'AI テキスト抽出' },
  { key: 'extractingJson', label: 'AI 構造化データ抽出' },
  { key: 'saving', label: 'データベースへ保存' },
];

const isInAIExtraction = (step: ProgressStep) => {
    return step === 'extractingText' || step === 'extractingJson';
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ progress }) => {
  if (progress.step === 'idle' || progress.step === 'done') {
    return (
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg mt-4">
             <div className="flex items-center gap-3 text-green-400">
                <CheckCircleIcon className="h-6 w-6 flex-shrink-0" />
                <p className="text-sm font-semibold">処理が正常に完了しました。</p>
            </div>
        </div>
    );
  }

  const getStepStatus = (stepKey: ProgressStep) => {
    if (progress.completedSteps.has(stepKey)) {
      return 'completed';
    }
    // AI抽出は並列実行なので両方実行中に見せる
    if (isInAIExtraction(progress.step) && isInAIExtraction(stepKey)) {
        return 'in_progress';
    }
    if (progress.step === stepKey) {
      return 'in_progress';
    }
    return 'pending';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg mt-4">
      <h3 className="text-md font-semibold mb-4 text-white">処理状況</h3>
      <ol className="space-y-4">
        {steps.map(step => {
          const status = getStepStatus(step.key);
          const icon = {
            completed: <CheckCircleIcon className="h-6 w-6 text-green-400 flex-shrink-0" />,
            in_progress: <div className="h-6 w-6 flex items-center justify-center flex-shrink-0"><Loader /></div>,
            pending: <div className="h-6 w-6 flex items-center justify-center flex-shrink-0"><ClockIcon className="h-5 w-5 text-gray-500" /></div>,
          }[status];
          const textColor = {
            completed: 'text-gray-400 line-through',
            in_progress: 'text-cyan-300 font-semibold animate-pulse',
            pending: 'text-gray-500',
          }[status];

          return (
            <li key={step.key} className="flex items-center gap-3">
              {icon}
              <span className={`text-sm ${textColor}`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {progress.step === 'error' && (
        <div className="mt-4 flex items-start gap-2 text-red-400 border-t border-gray-700 pt-4">
            <XCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">エラーが発生しました</p>
              <p className="text-xs mt-1">{progress.error || '不明なエラーが発生しました。'}</p>
            </div>
        </div>
      )}
    </div>
  );
};
