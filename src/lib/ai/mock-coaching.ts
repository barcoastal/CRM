import type { TranscriptEntry, CoachingTip, CoachingService } from './types';

interface KeywordRule {
  keywords: string[];
  type: CoachingTip['type'];
  text: string;
  speakerFilter?: 'agent' | 'lead';
}

const keywordRules: KeywordRule[] = [
  {
    keywords: ['expensive', 'cost', 'afford', 'too much', 'pricey', 'fee'],
    type: 'objection',
    text: 'Price objection detected — emphasize performance-based fees and total savings vs. paying full balance.',
    speakerFilter: 'lead',
  },
  {
    keywords: ['not sure', 'think about it', 'let me think', 'need to consider', 'maybe later'],
    type: 'objection',
    text: 'Hesitation detected — try offering the free, no-obligation debt analysis to lower commitment.',
    speakerFilter: 'lead',
  },
  {
    keywords: ['how does it work', 'tell me more', 'explain', 'what do you do', 'how do you'],
    type: 'buying_signal',
    text: 'Buying signal! Lead is asking for details — move to qualification questions and uncover their debt specifics.',
    speakerFilter: 'lead',
  },
  {
    keywords: ['competitor', 'another company', 'someone else', 'other firm', 'other service', 'other option'],
    type: 'warning',
    text: 'Competitor mentioned — highlight your unique advantages: performance-based fees, dedicated account manager, proven track record.',
    speakerFilter: 'lead',
  },
  {
    keywords: ['struggling', 'behind on payments', 'can\'t keep up', 'falling behind', 'overwhelmed', 'stressed', 'tough spot'],
    type: 'suggestion',
    text: 'Pain point identified — empathize with their situation and present the settlement solution as relief.',
    speakerFilter: 'lead',
  },
  {
    keywords: ['interested', 'sounds good', 'let\'s do it', 'sign me up', 'move forward', 'next step'],
    type: 'buying_signal',
    text: 'Strong buying signal detected! Lead is ready to move forward — transition to enrollment or scheduling.',
    speakerFilter: 'lead',
  },
  {
    keywords: ['collections', 'collector', 'collection calls', 'being sued', 'lawsuit', 'legal action'],
    type: 'suggestion',
    text: 'Urgency indicator — the lead is facing collection pressure. Emphasize how enrollment stops creditor harassment.',
    speakerFilter: 'lead',
  },
  {
    keywords: ['not interested', 'don\'t call', 'stop calling', 'no thanks', 'waste of time'],
    type: 'warning',
    text: 'Lead is disengaging — acknowledge their position respectfully. Consider asking one clarifying question before ending.',
    speakerFilter: 'lead',
  },
  {
    keywords: ['accountant', 'lawyer', 'attorney', 'advisor', 'spouse', 'partner'],
    type: 'suggestion',
    text: 'Third-party influencer mentioned — offer to include them in the next call or provide materials they can review.',
    speakerFilter: 'lead',
  },
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function detectConsecutiveAgentTurns(entries: TranscriptEntry[]): CoachingTip[] {
  const tips: CoachingTip[] = [];
  let consecutiveAgentTurns = 0;

  for (const entry of entries) {
    if (entry.speaker === 'agent') {
      consecutiveAgentTurns++;
      if (consecutiveAgentTurns >= 3) {
        tips.push({
          id: `consecutive-agent-${entry.timestamp}`,
          type: 'warning',
          text: "You've been talking a lot — ask an open-ended question to let the lead share more.",
          timestamp: entry.timestamp,
        });
        consecutiveAgentTurns = 0; // Reset so we don't flood tips
      }
    } else {
      consecutiveAgentTurns = 0;
    }
  }

  return tips;
}

function detectAmountMentioned(entries: TranscriptEntry[]): CoachingTip[] {
  const tips: CoachingTip[] = [];
  const amountRegex = /\$[\d,]+(?:\.\d{2})?|\d{2,3}(?:,\d{3})+|\d+\s*(?:thousand|k|grand)/i;

  for (const entry of entries) {
    if (entry.speaker === 'lead' && amountRegex.test(entry.text)) {
      tips.push({
        id: `amount-${entry.timestamp}`,
        type: 'buying_signal',
        text: "They mentioned a specific number — use it in your pitch to make the savings calculation concrete.",
        timestamp: entry.timestamp,
      });
    }
  }

  return tips;
}

export class MockCoachingService implements CoachingService {
  getTipsForTranscript(entries: TranscriptEntry[]): CoachingTip[] {
    const tips: CoachingTip[] = [];
    const usedRules = new Set<number>();

    for (const entry of entries) {
      for (let i = 0; i < keywordRules.length; i++) {
        if (usedRules.has(i)) continue;

        const rule = keywordRules[i];
        if (rule.speakerFilter && rule.speakerFilter !== entry.speaker) continue;

        if (matchesKeywords(entry.text, rule.keywords)) {
          tips.push({
            id: `rule-${i}-${entry.timestamp}`,
            type: rule.type,
            text: rule.text,
            timestamp: entry.timestamp,
          });
          usedRules.add(i);
        }
      }
    }

    // Add consecutive-agent-turn warnings
    tips.push(...detectConsecutiveAgentTurns(entries));

    // Add amount-mentioned tips
    tips.push(...detectAmountMentioned(entries));

    // Sort by timestamp
    tips.sort((a, b) => a.timestamp - b.timestamp);

    return tips;
  }
}
