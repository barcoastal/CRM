import type { TranscriptEntry, TranscriptionService } from './types';

// Scenario 1: Qualifying a lead
const qualifyingLead: TranscriptEntry[] = [
  { speaker: 'agent', text: "Hi, this is Mike from Coastal Debt Solutions. Am I speaking with the business owner?", timestamp: 0 },
  { speaker: 'lead', text: "Yeah, this is Tom. What's this about?", timestamp: 5 },
  { speaker: 'agent', text: "Tom, thanks for taking my call. We help small business owners who are dealing with overwhelming business debt — credit lines, vendor balances, that sort of thing. I wanted to see if that's something you might be dealing with.", timestamp: 10 },
  { speaker: 'lead', text: "Actually, yeah. We've been struggling a bit. We have a couple of credit lines that are way overdue.", timestamp: 22 },
  { speaker: 'agent', text: "I'm sorry to hear that, Tom. You're not alone — a lot of business owners are in a similar spot right now. Can I ask, roughly how much total business debt are we talking about?", timestamp: 30 },
  { speaker: 'lead', text: "Probably around $85,000 between the two credit lines and a vendor we owe.", timestamp: 42 },
  { speaker: 'agent', text: "Okay, $85,000. And are these all business debts, not personal?", timestamp: 50 },
  { speaker: 'lead', text: "Yeah, all business. My personal stuff is fine, it's just the business that's underwater.", timestamp: 55 },
  { speaker: 'agent', text: "Got it. And how long has it been since you've been able to make the minimum payments on these?", timestamp: 62 },
  { speaker: 'lead', text: "A couple of months now. We just can't keep up with all of them.", timestamp: 70 },
  { speaker: 'agent', text: "That makes sense. Tom, what we do is negotiate directly with your creditors to settle those debts for significantly less than what you owe — typically 40 to 60 cents on the dollar. Would that be something you'd want to learn more about?", timestamp: 76 },
  { speaker: 'lead', text: "That does sound interesting. How does it work exactly?", timestamp: 90 },
  { speaker: 'agent', text: "Great question. Basically, we assess all your business debts, then we reach out to each creditor on your behalf and negotiate a lump-sum settlement. You'd make one affordable monthly payment into a dedicated account, and as that builds up, we settle each debt one by one.", timestamp: 95 },
  { speaker: 'lead', text: "And how long does that usually take?", timestamp: 112 },
  { speaker: 'agent', text: "For an $85,000 situation like yours, we'd typically be looking at 12 to 24 months to get everything resolved. The best part is, our fees are performance-based — we only get paid when we actually settle a debt for you.", timestamp: 117 },
  { speaker: 'lead', text: "Okay, that sounds fair. I'd like to know more. What's the next step?", timestamp: 130 },
  { speaker: 'agent', text: "Perfect. The next step is a free, no-obligation debt analysis where we pull all your accounts together and give you a clear picture of what we can do. Can I set that up for you this week? How does Thursday at 2 PM work?", timestamp: 135 },
  { speaker: 'lead', text: "Thursday works. Let's do it.", timestamp: 148 },
  { speaker: 'agent', text: "Excellent, Tom. I've got you down for Thursday at 2 PM. I'll send you a confirmation email. Thanks for your time today, and we'll get this sorted out for you.", timestamp: 151 },
  { speaker: 'lead', text: "Thanks, Mike. Talk to you Thursday.", timestamp: 162 },
];

// Scenario 2: Handling "too expensive" objection
const tooExpensiveObjection: TranscriptEntry[] = [
  { speaker: 'agent', text: "Hi, this is Sarah from Coastal Debt Solutions. Is this Jennifer?", timestamp: 0 },
  { speaker: 'lead', text: "Yes, hi Sarah.", timestamp: 4 },
  { speaker: 'agent', text: "Jennifer, thanks for picking up. I'm following up on the information you requested about our business debt settlement program. Do you have a few minutes to chat?", timestamp: 7 },
  { speaker: 'lead', text: "Sure, but I have to be honest — I've been looking into this and it seems pretty expensive.", timestamp: 15 },
  { speaker: 'agent', text: "I appreciate your honesty, Jennifer. Cost is definitely an important factor. Can I ask what you've seen that concerned you?", timestamp: 22 },
  { speaker: 'lead', text: "Well, I talked to another company and they wanted 25% of my total debt as their fee. That's a lot of money on top of what I already owe.", timestamp: 28 },
  { speaker: 'agent', text: "I totally understand that concern. Here's the thing though — our fees are performance-based, meaning we only charge when we actually settle a debt. So if we don't save you money, you don't pay us. And typically, even after our fee, clients save 30 to 50 percent compared to paying the full balance.", timestamp: 38 },
  { speaker: 'lead', text: "But I still have to pay your fee on top of the settlement amount, right?", timestamp: 52 },
  { speaker: 'agent', text: "Yes, but let me put it in perspective. Let's say you owe $100,000. If we settle for 45 cents on the dollar, that's $45,000. Even with our fee, your total cost is around $65,000. Compare that to paying the full $100,000 — you're still saving $35,000. Does that make sense?", timestamp: 56 },
  { speaker: 'lead', text: "When you put it that way, yeah. I just wasn't sure if the math worked out.", timestamp: 72 },
  { speaker: 'agent', text: "It definitely does, and that's exactly what our free analysis covers — we show you the real numbers for your specific situation so there are no surprises. How much business debt are you dealing with, Jennifer?", timestamp: 77 },
  { speaker: 'lead', text: "Around $120,000. Mostly from a business line of credit and some supplier debts.", timestamp: 88 },
  { speaker: 'agent', text: "With $120,000, the savings potential is even more significant. Jennifer, I'd love to set up that free analysis so you can see the exact numbers. There's no commitment — just clarity. Would tomorrow afternoon work for a 20-minute call?", timestamp: 93 },
  { speaker: 'lead', text: "I think I can afford to at least look at the numbers. Sure, let's do tomorrow at 3.", timestamp: 107 },
  { speaker: 'agent', text: "Great choice, Jennifer. I'll send you a calendar invite right now. And don't worry — no pressure, just information. Talk to you tomorrow!", timestamp: 112 },
  { speaker: 'lead', text: "Sounds good. Thanks, Sarah.", timestamp: 122 },
];

// Scenario 3: Successful enrollment
const successfulEnrollment: TranscriptEntry[] = [
  { speaker: 'agent', text: "Hi David, it's Mike from Coastal Debt Solutions. We spoke last week about your business debt situation. How are you doing?", timestamp: 0 },
  { speaker: 'lead', text: "Hey Mike, I'm doing okay. I've been thinking a lot about what we discussed.", timestamp: 7 },
  { speaker: 'agent', text: "That's great to hear. Last time we went over the analysis and you were looking at about $95,000 in total business debt, with a projected settlement range of $42,000 to $52,000. Did you have any questions about that?", timestamp: 13 },
  { speaker: 'lead', text: "Actually, I showed the numbers to my accountant and she said it looks like a solid option. My main question is about the monthly payment — you said around $2,800 a month?", timestamp: 26 },
  { speaker: 'agent', text: "That's right, $2,800 per month into your dedicated settlement account. That's manageable compared to the $4,200 in minimums you're currently behind on, right?", timestamp: 38 },
  { speaker: 'lead', text: "Yeah, definitely more manageable. And you said the program is about 18 months?", timestamp: 48 },
  { speaker: 'agent', text: "That's our estimate, yes. Some debts may settle faster — it depends on how the creditor negotiations go. But 18 months is a realistic timeline to get everything resolved.", timestamp: 53 },
  { speaker: 'lead', text: "Okay. And the creditors will stop calling once I'm enrolled?", timestamp: 64 },
  { speaker: 'agent', text: "Once we send out our representation letters, creditors are required to communicate through us instead of contacting you directly. Most of our clients see a significant drop in collection calls within the first couple of weeks.", timestamp: 69 },
  { speaker: 'lead', text: "That would be a huge relief, honestly. Those calls have been stressing me out.", timestamp: 82 },
  { speaker: 'agent', text: "I completely understand, David. That's one of the biggest benefits our clients talk about — just the peace of mind. So, are you ready to move forward and get this process started?", timestamp: 87 },
  { speaker: 'lead', text: "You know what, yeah. Let's do it. I've been putting this off too long.", timestamp: 97 },
  { speaker: 'agent', text: "That's a great decision, David. I'm going to walk you through the enrollment paperwork right now. It'll take about 15 minutes. First, I'll need to verify some information about your business and the debts we discussed.", timestamp: 101 },
  { speaker: 'lead', text: "Sure, I have everything right here.", timestamp: 114 },
  { speaker: 'agent', text: "Perfect. Let's start with your business legal name and EIN. And David, I just want to say — you're making a really smart move for your business. We're going to get this handled for you.", timestamp: 117 },
  { speaker: 'lead', text: "Thanks, Mike. I feel good about it. Let's get started.", timestamp: 128 },
];

// Scenario 4: "Not interested" call
const notInterested: TranscriptEntry[] = [
  { speaker: 'agent', text: "Hi, this is Sarah from Coastal Debt Solutions. Am I speaking with Robert?", timestamp: 0 },
  { speaker: 'lead', text: "Yeah, what do you want?", timestamp: 5 },
  { speaker: 'agent', text: "Robert, we help business owners resolve their business debt through settlement. I wanted to see if —", timestamp: 8 },
  { speaker: 'lead', text: "Not interested. We don't have any debt problems.", timestamp: 14 },
  { speaker: 'agent', text: "I understand, Robert. Just to clarify, we specifically work with business debts like credit lines, vendor balances, and business loans. Is that something you're dealing with at all?", timestamp: 18 },
  { speaker: 'lead', text: "No. My business is doing fine. I don't know where you got my number.", timestamp: 27 },
  { speaker: 'agent', text: "I apologize for the inconvenience. If your situation ever changes, we're always here to help. Would it be okay if I sent you our information just in case?", timestamp: 33 },
  { speaker: 'lead', text: "No, thanks. Please don't call me again.", timestamp: 41 },
  { speaker: 'agent', text: "Absolutely, Robert. I'll remove your number from our list right away. Sorry for the disruption, and I wish you continued success with your business. Have a great day.", timestamp: 45 },
  { speaker: 'lead', text: "Thanks. Bye.", timestamp: 55 },
];

// Scenario 5: Callback scheduling
const callbackScheduling: TranscriptEntry[] = [
  { speaker: 'agent', text: "Hi, is this Maria? This is Mike calling from Coastal Debt Solutions.", timestamp: 0 },
  { speaker: 'lead', text: "Yes, hi. I actually can't really talk right now, I'm in the middle of something.", timestamp: 5 },
  { speaker: 'agent', text: "No problem at all, Maria. I'll be very brief — we help business owners settle their business debts for less than they owe. I understand you submitted an inquiry on our website?", timestamp: 11 },
  { speaker: 'lead', text: "Oh right, yeah I did. But I really can't talk now. Can you call me back?", timestamp: 21 },
  { speaker: 'agent', text: "Of course! When would be a good time for you? I want to make sure I catch you when you have about 10 to 15 minutes.", timestamp: 27 },
  { speaker: 'lead', text: "Um, how about tomorrow? I'm usually free after lunch, so maybe 1 o'clock?", timestamp: 34 },
  { speaker: 'agent', text: "Tomorrow at 1 PM works perfectly. And just so I'm prepared — could you give me a quick idea of what kind of business debt we're talking about? Rough ballpark?", timestamp: 40 },
  { speaker: 'lead', text: "It's maybe around $60,000. Mostly credit cards and a business loan that I'm behind on payments.", timestamp: 50 },
  { speaker: 'agent', text: "Got it, $60,000. That's definitely something we can help with. I'll call you tomorrow at 1 PM sharp, Maria. And just so you know, we offer a free analysis with no obligation.", timestamp: 58 },
  { speaker: 'lead', text: "Okay, that sounds good. Talk to you tomorrow then.", timestamp: 69 },
  { speaker: 'agent', text: "Perfect. Have a great rest of your day, Maria!", timestamp: 73 },
  { speaker: 'lead', text: "Thanks, bye!", timestamp: 77 },
];

// Scenario 6: Voicemail follow-up
const voicemailFollowUp: TranscriptEntry[] = [
  { speaker: 'agent', text: "Hi, this is Sarah from Coastal Debt Solutions calling for James. I left you a voicemail last week about our business debt settlement program. Is this a good time?", timestamp: 0 },
  { speaker: 'lead', text: "Oh yeah, I got that message. I've been meaning to call back. We're actually in a pretty tough spot right now.", timestamp: 10 },
  { speaker: 'agent', text: "I'm sorry to hear you're going through a tough time, James. Can you tell me a little about what's going on?", timestamp: 19 },
  { speaker: 'lead', text: "Well, business slowed way down last year and we ended up falling behind on payments to a few creditors. Now they're sending everything to collections and I'm getting calls every day.", timestamp: 25 },
  { speaker: 'agent', text: "That sounds incredibly stressful. How much would you say you owe in total to those creditors?", timestamp: 38 },
  { speaker: 'lead', text: "I think it's around $150,000 total. Maybe a little more. There's a large business line of credit, two credit cards, and some vendor debts.", timestamp: 44 },
  { speaker: 'agent', text: "James, with $150,000 in debt, you're exactly the kind of business owner we help. Our settlement program could potentially save you 40 to 60 percent of what you owe. And once you enroll, we handle all creditor communication, so those daily calls stop.", timestamp: 55 },
  { speaker: 'lead', text: "That would be amazing. But I'm not sure I can even afford a payment right now. Things are really tight.", timestamp: 69 },
  { speaker: 'agent', text: "I completely understand. The good news is, the monthly program payment is usually much less than what your minimums were. And we structure it around what you can actually afford. Would you be open to doing a free debt analysis? It takes about 20 minutes and there's zero obligation.", timestamp: 76 },
  { speaker: 'lead', text: "I guess it can't hurt to look at the numbers. What do I need to have ready?", timestamp: 92 },
  { speaker: 'agent', text: "Just a list of your creditors with the approximate balances. Even rough numbers work — we can verify everything. Would you want to do that analysis now, or schedule it for another time?", timestamp: 97 },
  { speaker: 'lead', text: "Let me gather the paperwork first. Can we do it this Friday?", timestamp: 109 },
  { speaker: 'agent', text: "Friday works great. How about 10 AM? That way we can take our time going through everything.", timestamp: 114 },
  { speaker: 'lead', text: "Friday at 10 sounds good. Thanks for calling back, Sarah. I appreciate it.", timestamp: 121 },
  { speaker: 'agent', text: "Of course, James. Hang in there — we're going to figure this out together. I'll send you a confirmation email with everything you need. Talk to you Friday!", timestamp: 126 },
  { speaker: 'lead', text: "Sounds great. Bye.", timestamp: 137 },
];

const scenarios: TranscriptEntry[][] = [
  qualifyingLead,
  tooExpensiveObjection,
  successfulEnrollment,
  notInterested,
  callbackScheduling,
  voicemailFollowUp,
];

function scaleTranscript(
  scenario: TranscriptEntry[],
  targetDurationSeconds: number
): TranscriptEntry[] {
  if (scenario.length === 0) return [];

  const lastTimestamp = scenario[scenario.length - 1].timestamp;
  if (lastTimestamp === 0) return scenario;

  const scale = targetDurationSeconds / lastTimestamp;

  return scenario.map((entry) => ({
    ...entry,
    timestamp: Math.round(entry.timestamp * scale),
  }));
}

export class MockTranscriptionService implements TranscriptionService {
  private scenarioIndex: number;

  constructor(scenarioIndex?: number) {
    this.scenarioIndex =
      scenarioIndex !== undefined
        ? scenarioIndex % scenarios.length
        : Math.floor(Math.random() * scenarios.length);
  }

  getTranscriptForCall(callDurationSeconds: number): TranscriptEntry[] {
    const scenario = scenarios[this.scenarioIndex];
    return scaleTranscript(scenario, callDurationSeconds);
  }
}

export { scenarios };
