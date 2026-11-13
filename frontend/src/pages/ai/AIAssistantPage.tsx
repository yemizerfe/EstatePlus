import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Bot,
  ExternalLink,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
  User,
} from 'lucide-react';

import { askQuestion, fetchAiStatus, isAiNotConfigured, type AiGroundingSummary } from '../../api/ai';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  grounding?: AiGroundingSummary;
}

const SUGGESTED_QUESTIONS = [
  'What does the stored data say about median asking prices?',
  'Which neighborhoods have enough listings to compare?',
  'What rental figures can you state, and what is missing?',
  'How many active listings are recorded and where?',
  'What economic indicators are stored with a source link?',
  'Is there enough data to describe a price trend this year?',
];

let messageCounter = 0;
const nextId = () => {
  messageCounter += 1;
  return `m${messageCounter}`;
};

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: nextId(),
      content:
        'This assistant answers only from records retrieved from the EstatePlus database. Every answer carries the records it used, source links where the data has them, and the limitations of that data.',
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const statusQuery = useQuery({
    queryKey: ['ai-status'],
    queryFn: fetchAiStatus,
    retry: false,
  });

  const askMutation = useMutation({
    mutationFn: (question: string) => askQuestion(question),
    onMutate: (question) => {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), content: question, sender: 'user', timestamp: new Date() },
      ]);
      setInputMessage('');
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          content: data.answer,
          sender: 'ai',
          timestamp: new Date(),
          grounding: data.grounding,
        },
      ]);
    },
    onError: (error) => {
      const content = isAiNotConfigured(error)
        ? `${error.response.data.message}\n\nThe market pages, charts and filters keep working without the AI service — only this model-written answer is unavailable.`
        : 'The AI service is unavailable right now. No answer was generated. The market data pages are unaffected.';
      setMessages((prev) => [
        ...prev,
        { id: nextId(), content, sender: 'ai', timestamp: new Date() },
      ]);
    },
  });

  const configured = statusQuery.data?.configured ?? false;
  const canAsk = configured && !askMutation.isPending;

  const handleSend = (question: string) => {
    const trimmed = question.trim();
    if (trimmed.length < 5 || !canAsk) return;
    askMutation.mutate(trimmed);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, askMutation.isPending]);

  return (
    <div className="flex h-[calc(100vh-110px)] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/60 shadow-[0_18px_50px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      <div className="flex-shrink-0 border-b border-white/10 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-slate-900/5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/20">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">EstatePlus AI</h1>
              <p className="text-sm text-slate-300">
                Retrieval-grounded market analysis — no invented statistics
              </p>
            </div>
          </div>
          <span
            className={`hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              statusQuery.isLoading
                ? 'bg-white/10 text-slate-300'
                : configured
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {statusQuery.isLoading
              ? 'Checking provider'
              : configured
                ? `Connected · ${statusQuery.data?.model}`
                : 'Provider not configured'}
          </span>
        </div>
      </div>

      {!statusQuery.isLoading && statusQuery.data && !configured && (
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-amber-500/20 bg-amber-500/5 px-5 py-4 sm:px-6">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
          <div className="text-sm text-amber-100/90">
            <p className="font-semibold text-amber-200">AI analysis is not configured</p>
            <p className="mt-1">{statusQuery.data.message}</p>
            <p className="mt-1 text-xs text-amber-200/70">
              Missing:{' '}
              {statusQuery.data.missingEnvironmentVariables.length > 0
                ? statusQuery.data.missingEnvironmentVariables.join(', ')
                : 'unknown configuration'}
              . Retrieval over stored records is ready; only the model call is disabled.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender === 'ai' && (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 shadow-md shadow-slate-900/20">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-3xl rounded-2xl px-4 py-3 sm:px-5 sm:py-4 ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20'
                      : 'border border-white/10 bg-slate-900/50 text-slate-100'
                  }`}
                >
                  <div className="whitespace-pre-line text-sm leading-7 sm:text-[15px]">
                    {message.content}
                  </div>

                  {message.grounding && (
                    <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs text-slate-400">
                      <p>
                        Retrieved {message.grounding.counts.facts} fact(s),{' '}
                        {message.grounding.counts.calculations} calculated metric(s),{' '}
                        {message.grounding.counts.listings} listing(s) ·{' '}
                        {message.grounding.scope.neighborhood?.name ?? 'city-wide'} · last{' '}
                        {message.grounding.scope.months} months
                      </p>
                      {message.grounding.citations.map((citation) => (
                        <p key={citation.id} className="flex items-start gap-1">
                          <ExternalLink className="mt-0.5 h-3 w-3" />
                          {citation.url ? (
                            <a
                              href={citation.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              {citation.label}
                            </a>
                          ) : (
                            <span>{citation.label}</span>
                          )}
                          {citation.asOf ? <span>· {citation.asOf}</span> : null}
                        </p>
                      ))}
                      {message.grounding.limitations.slice(0, 3).map((limitation) => (
                        <p key={limitation} className="text-slate-500">
                          {limitation}
                        </p>
                      ))}
                    </div>
                  )}

                  <div
                    className={`mt-2 text-[11px] ${
                      message.sender === 'user' ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {message.sender === 'user' && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {askMutation.isPending && (
              <div className="flex justify-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                  <span className="text-xs text-slate-400">
                    Retrieving matching records, then asking the model…
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="flex-shrink-0 border-t border-white/10 bg-slate-950/30 p-4 sm:p-6">
            <div className="flex gap-3">
              <textarea
                value={inputMessage}
                onChange={(event) => setInputMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend(inputMessage);
                  }
                }}
                disabled={!configured}
                placeholder={
                  configured
                    ? 'Ask about stored prices, rents, neighborhoods or indicators…'
                    : 'Ask after OPENAI_API_KEY is configured on the backend…'
                }
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                rows={1}
                maxLength={500}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
              <button
                onClick={() => handleSend(inputMessage)}
                disabled={!canAsk || inputMessage.trim().length < 5}
                className="rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {askMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {inputMessage.length}/500 · answers use retrieved database records and may state that
              a figure is unavailable.
            </p>
          </div>
        </div>

        <aside className="hidden w-80 overflow-y-auto border-l border-white/10 bg-slate-950/20 p-5 xl:block">
          <div className="mb-8">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <Sparkles className="h-5 w-5 text-cyan-400" />
              What the AI can answer
            </h3>
            <ul className="space-y-1 text-sm text-slate-300">
              <li>• Median asking prices and rents from stored listings</li>
              <li>• Neighborhood comparisons where the sample is sufficient</li>
              <li>• Calculated metrics such as price per m² and gross yield</li>
              <li>• Stored economic indicators with their publishers and dates</li>
            </ul>
          </div>

          <div className="mb-8">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <Lightbulb className="h-5 w-5 text-yellow-400" />
              Try asking
            </h3>
            <div className="space-y-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  onClick={() => handleSend(question)}
                  disabled={!canAsk}
                  className="w-full rounded-lg p-2 text-left text-sm text-slate-300 transition hover:bg-slate-900/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
            <h4 className="mb-2 font-medium text-blue-200">How answers are produced</h4>
            <p className="text-sm text-blue-100/80">
              The backend resolves the neighborhood, property, date range and filters in your
              question, retrieves only the matching records, and separates database facts from
              calculated metrics. The model may not add numbers of its own.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
