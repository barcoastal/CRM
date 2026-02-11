import type { TranscriptEntry, CallFeedbackData, FeedbackService } from './types';

const qualificationKeywords = [
  'how much', 'total debt', 'what do you owe', 'business debt',
  'how long', 'minimum payments', 'creditors', 'behind on',
  'what kind of debt', 'personal or business',
];

const objectionHandlingKeywords = [
  'i understand', 'i appreciate', 'that makes sense', 'good question',
  'let me explain', 'here\'s the thing', 'put it in perspective',
  'totally understand', 'i hear you', 'great point',
];

const closingKeywords = [
  'move forward', 'next step', 'set up', 'schedule', 'enroll',
  'get started', 'sign up', 'ready to', 'let\'s do',
  'free analysis', 'no obligation',
];

const empathyKeywords = [
  'sorry to hear', 'i understand', 'you\'re not alone',
  'completely understand', 'that sounds', 'hang in there',
  'we\'re going to', 'get this sorted', 'figure this out',
];

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function containsKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function extractLeadName(entries: TranscriptEntry[]): string | null {
  // Look for common name patterns in agent speech
  for (const entry of entries) {
    if (entry.speaker === 'agent') {
      // Match patterns like "Hi Tom", "speaking with Tom", "thanks Tom"
      const namePatterns = [
        /speaking with (\w+)/i,
        /is this (\w+)/i,
        /hi (\w+)/i,
        /thanks?,? (\w+)/i,
        /hello (\w+)/i,
      ];
      for (const pattern of namePatterns) {
        const match = entry.text.match(pattern);
        if (match && match[1].length > 1) {
          return match[1];
        }
      }
    }
  }
  return null;
}

function generateKeyMoments(entries: TranscriptEntry[]): CallFeedbackData['keyMoments'] {
  const moments: CallFeedbackData['keyMoments'] = [];

  for (const entry of entries) {
    if (entry.speaker === 'lead') {
      // Detect objections
      if (containsKeyword(entry.text, ['not interested', 'expensive', 'can\'t afford', 'not sure', 'think about it'])) {
        moments.push({
          timestamp: entry.timestamp,
          type: 'objection',
          description: `Lead raised concern: "${entry.text.substring(0, 60)}${entry.text.length > 60 ? '...' : ''}"`,
        });
      }
      // Detect buying signals
      if (containsKeyword(entry.text, ['sounds good', 'let\'s do it', 'interested', 'next step', 'move forward', 'sign me up'])) {
        moments.push({
          timestamp: entry.timestamp,
          type: 'buying_signal',
          description: `Lead showed interest: "${entry.text.substring(0, 60)}${entry.text.length > 60 ? '...' : ''}"`,
        });
      }
      // Detect pain points
      if (containsKeyword(entry.text, ['struggling', 'behind on payments', 'stressed', 'tough spot', 'overwhelmed', 'collections'])) {
        moments.push({
          timestamp: entry.timestamp,
          type: 'pain_point',
          description: `Lead expressed pain point: "${entry.text.substring(0, 60)}${entry.text.length > 60 ? '...' : ''}"`,
        });
      }
      // Detect amount mentioned
      if (/\$[\d,]+/.test(entry.text)) {
        moments.push({
          timestamp: entry.timestamp,
          type: 'amount_mentioned',
          description: `Lead disclosed debt amount in this exchange.`,
        });
      }
    }

    if (entry.speaker === 'agent') {
      // Detect closing attempt
      if (containsKeyword(entry.text, closingKeywords)) {
        moments.push({
          timestamp: entry.timestamp,
          type: 'closing_attempt',
          description: `Agent attempted to close or schedule next step.`,
        });
      }
    }
  }

  return moments.slice(0, 8); // Cap at 8 key moments
}

function generateCallSummary(entries: TranscriptEntry[], leadName: string | null): string {
  const agentEntries = entries.filter((e) => e.speaker === 'agent');
  const leadEntries = entries.filter((e) => e.speaker === 'lead');
  const hadObjection = leadEntries.some((e) =>
    containsKeyword(e.text, ['expensive', 'not sure', 'not interested', 'can\'t afford', 'think about it'])
  );
  const hadClosing = agentEntries.some((e) => containsKeyword(e.text, closingKeywords));
  const wasPositive = leadEntries.some((e) =>
    containsKeyword(e.text, ['sounds good', 'let\'s do it', 'interested', 'move forward'])
  );
  const wasNegative = leadEntries.some((e) =>
    containsKeyword(e.text, ['not interested', 'don\'t call', 'stop calling'])
  );

  const name = leadName || 'the lead';

  if (wasNegative) {
    return `The agent contacted ${name} but they were not interested in the service. The agent handled the rejection professionally and respected the lead's wishes. This was a short call with no qualification opportunity.`;
  }

  if (wasPositive && hadClosing) {
    return `Productive call with ${name} who showed strong interest in the debt settlement program. The agent successfully guided the conversation through qualification and${hadObjection ? ' handled objections before' : ''} moved to scheduling next steps. Good outcome with clear follow-up action established.`;
  }

  if (hadObjection) {
    return `The agent spoke with ${name} who raised concerns during the call. The agent addressed the objections and worked to build trust. ${hadClosing ? 'A follow-up was scheduled to continue the conversation.' : 'The call ended without a firm next step, which is an area for improvement.'}`;
  }

  return `The agent connected with ${name} and discussed the debt settlement program. ${hadClosing ? 'The conversation progressed to scheduling a follow-up consultation.' : 'The conversation covered the basics of the program.'} Overall, the call was professional and informative.`;
}

export class MockFeedbackService implements FeedbackService {
  generateFeedback(transcript: TranscriptEntry[]): CallFeedbackData {
    if (transcript.length === 0) {
      return {
        overallScore: 0,
        talkRatio: 0,
        objectionHandling: 0,
        closingAttempt: false,
        keyMoments: [],
        improvements: ['No transcript data available for analysis.'],
        strengths: [],
        summary: 'No transcript data available.',
      };
    }

    const agentEntries = transcript.filter((e) => e.speaker === 'agent');
    const leadEntries = transcript.filter((e) => e.speaker === 'lead');

    // Calculate talk ratio
    const agentWords = agentEntries.reduce((sum, e) => sum + countWords(e.text), 0);
    const leadWords = leadEntries.reduce((sum, e) => sum + countWords(e.text), 0);
    const totalWords = agentWords + leadWords;
    const talkRatio = totalWords > 0 ? Math.round((agentWords / totalWords) * 100) : 50;

    // Check for qualification questions
    const askedQualification = agentEntries.some((e) =>
      containsKeyword(e.text, qualificationKeywords)
    );

    // Check for objection handling
    const leadHadObjections = leadEntries.some((e) =>
      containsKeyword(e.text, ['expensive', 'not sure', 'can\'t afford', 'think about it', 'not interested'])
    );
    const handledObjections = leadHadObjections
      ? agentEntries.some((e) => containsKeyword(e.text, objectionHandlingKeywords))
      : false;

    // Check for closing attempt
    const closingAttempt = agentEntries.some((e) =>
      containsKeyword(e.text, closingKeywords)
    );

    // Check for empathy
    const showedEmpathy = agentEntries.some((e) =>
      containsKeyword(e.text, empathyKeywords)
    );

    // Check if agent used lead's name
    const leadName = extractLeadName(transcript);
    const usedLeadName = leadName
      ? agentEntries.filter((e) => e.text.toLowerCase().includes(leadName.toLowerCase())).length >= 2
      : false;

    // Calculate objection handling score
    let objectionHandlingScore = 50; // base
    if (!leadHadObjections) {
      objectionHandlingScore = 70; // no objections to handle
    } else if (handledObjections) {
      objectionHandlingScore = 85;
    } else {
      objectionHandlingScore = 30;
    }

    // Calculate overall score
    let score = 40; // base score
    if (askedQualification) score += 12;
    if (handledObjections || !leadHadObjections) score += 10;
    if (closingAttempt) score += 12;
    if (talkRatio <= 60 && talkRatio >= 35) score += 8; // good talk ratio
    if (usedLeadName) score += 6;
    if (showedEmpathy) score += 7;
    if (transcript.length >= 10) score += 5; // meaningful conversation length

    // Cap score
    score = Math.min(100, Math.max(0, score));

    // Generate strengths
    const strengths: string[] = [];
    if (showedEmpathy) strengths.push('Good empathy — acknowledged the lead\'s situation effectively.');
    if (askedQualification) strengths.push('Asked strong qualification questions to understand the debt situation.');
    if (handledObjections) strengths.push('Handled objections professionally with clear, reassuring responses.');
    if (closingAttempt) strengths.push('Made a clear closing attempt with a specific next step.');
    if (usedLeadName) strengths.push('Personalized the conversation by using the lead\'s name throughout.');
    if (talkRatio <= 55 && talkRatio >= 35) strengths.push('Maintained a healthy talk-to-listen ratio, giving the lead space to share.');
    if (transcript.length >= 14) strengths.push('Kept the lead engaged for a meaningful conversation length.');

    if (strengths.length === 0) {
      strengths.push('Maintained professional tone throughout the call.');
    }

    // Generate improvements
    const improvements: string[] = [];
    if (talkRatio > 65) improvements.push('Reduce talk ratio — let the lead speak more. Aim for 40-60% agent talk time.');
    if (!askedQualification) improvements.push('Ask more qualification questions to uncover the full debt picture.');
    if (leadHadObjections && !handledObjections) improvements.push('Work on objection handling techniques — acknowledge concerns before responding.');
    if (!closingAttempt) improvements.push('Always attempt to close or set a clear next step before ending the call.');
    if (!usedLeadName && leadName) improvements.push(`Use the lead's name (${leadName}) more often to build rapport.`);
    if (!showedEmpathy) improvements.push('Show more empathy — acknowledge the lead\'s financial stress before pitching solutions.');
    if (talkRatio < 30) improvements.push('You may be too passive — guide the conversation more actively.');
    if (transcript.length < 8) improvements.push('Try to extend the conversation — gather more information before the lead disengages.');

    if (improvements.length === 0) {
      improvements.push('Continue refining your approach — even strong calls have room for growth.');
    }

    const keyMoments = generateKeyMoments(transcript);
    const summary = generateCallSummary(transcript, leadName);

    return {
      overallScore: score,
      talkRatio,
      objectionHandling: objectionHandlingScore,
      closingAttempt,
      keyMoments,
      improvements,
      strengths,
      summary,
    };
  }
}
