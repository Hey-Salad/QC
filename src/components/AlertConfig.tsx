/**
 * HeySalad QC - AlertConfig Component
 * 
 * Enable/disable alerts, email/Slack/SMS inputs.
 * Requirements: 4.5
 */

import type { AlertConfig as AlertConfigType, AlertTrigger } from '../types';
import { Input } from './Input';

export interface AlertConfigProps {
  config: AlertConfigType;
  onChange: (config: AlertConfigType) => void;
}

const TRIGGER_OPTIONS: { value: AlertTrigger; label: string; description: string }[] = [
  { value: 'missing_item', label: 'Missing Item', description: 'Alert when a required item is not detected' },
  { value: 'low_confidence', label: 'Low Confidence', description: 'Alert when detection confidence is below threshold' },
  { value: 'all_failures', label: 'All Failures', description: 'Alert on any inspection failure' },
];

export function AlertConfig({ config, onChange }: AlertConfigProps) {
  const handleEnabledChange = (enabled: boolean) => {
    onChange({ ...config, enabled });
  };

  const handleEmailChange = (email: string) => {
    onChange({ ...config, email: email || undefined });
  };

  const handleSlackChange = (slack_webhook: string) => {
    onChange({ ...config, slack_webhook: slack_webhook || undefined });
  };

  const handleSmsChange = (sms: string) => {
    onChange({ ...config, sms: sms || undefined });
  };

  const handleTriggerToggle = (trigger: AlertTrigger) => {
    const triggers = config.triggers.includes(trigger)
      ? config.triggers.filter(t => t !== trigger)
      : [...config.triggers, trigger];
    onChange({ ...config, triggers });
  };

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Alert Notifications</h3>
          <p className="text-xs text-gray-500">Receive notifications when inspections fail</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => handleEnabledChange(!config.enabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-tomato focus:ring-offset-2 ${
            config.enabled ? 'bg-tomato' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              config.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Alert Configuration (shown when enabled) */}
      {config.enabled && (
        <div className="space-y-5 pt-2 border-t border-gray-200">
          {/* Alert Triggers */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Alert Triggers</label>
            <div className="space-y-2">
              {TRIGGER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={config.triggers.includes(option.value)}
                    onChange={() => handleTriggerToggle(option.value)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-tomato focus:ring-tomato"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{option.label}</span>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notification Channels */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-700">Notification Channels</label>
            
            {/* Email */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="alerts@example.com"
                  value={config.email || ''}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  helperText="Email address for alert notifications"
                />
              </div>
            </div>

            {/* Slack */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                </svg>
              </div>
              <div className="flex-1">
                <Input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={config.slack_webhook || ''}
                  onChange={(e) => handleSlackChange(e.target.value)}
                  helperText="Slack webhook URL for channel notifications"
                />
              </div>
            </div>

            {/* SMS */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={config.sms || ''}
                  onChange={(e) => handleSmsChange(e.target.value)}
                  helperText="Phone number for SMS alerts"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
